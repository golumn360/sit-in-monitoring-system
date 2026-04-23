const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { error } = require("console");
const app = express();
const PORT = 3000;

// Configure multer for profile picture upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Initialize Database
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Connected to SQLite database");
    initializeDatabase();
  }
});

// Initialize database schema
function initializeDatabase() {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            idNumber TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            middleName TEXT,
            courseLevel TEXT,
            course TEXT,
            address TEXT,
            profilePic TEXT,
            sessionLeft INTEGER DEFAULT 30,
            isAdmin INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    (err) => {
      if (err) {
        console.error("Error creating users table:", err);
      } else {
        console.log("Users table ready");
        // Check if profilePic column exists, if not add it
        db.all("PRAGMA table_info(users)", [], (err, columns) => {
          if (!err) {
            const hasProfilePic = columns.some(
              (col) => col.name === "profilePic",
            );
            if (!hasProfilePic) {
              db.run(`ALTER TABLE users ADD COLUMN profilePic TEXT`, (err) => {
                if (err) {
                  // Ignore duplicate column error
                  if (!err.message.includes("duplicate column")) {
                    console.error("Error adding profilePic column:", err);
                  } else {
                    console.log("ProfilePic column already exists");
                  }
                } else {
                  console.log("ProfilePic column added successfully");
                }
              });
            }
            // Check if isAdmin column exists, if not add it
            const hasIsAdmin = columns.some((col) => col.name === "isAdmin");
            if (!hasIsAdmin) {
              db.run(
                `ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0`,
                (err) => {
                  if (err) {
                    if (!err.message.includes("duplicate column")) {
                      console.error("Error adding isAdmin column:", err);
                    }
                  } else {
                    console.log("isAdmin column added successfully");
                  }
                  // Create default admin account after table is ready
                  createDefaultAdmin();
                },
              );
            } else {
              // Create default admin account after table is ready
              createDefaultAdmin();
            }
          }
        });
      }
    },
  );
}

// Create default admin account
function createDefaultAdmin() {
  const adminEmail = "admin@uc.ccs";
  const adminIdNumber = "ADMIN001";

  // Check if admin already exists
  db.get(
    "SELECT id FROM users WHERE idNumber = ?",
    [adminIdNumber],
    async (err, user) => {
      if (err) {
        console.error("Error checking for admin:", err);
        return;
      }

      if (user) {
        return; // Silent - admin already exists
      }

      // Create admin account
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const sql = `INSERT INTO users (idNumber, email, password, firstName, lastName, middleName, courseLevel, course, address, sessionLeft, isAdmin) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 999, 1)`;

      db.run(
        sql,
        [
          adminIdNumber,
          adminEmail,
          hashedPassword,
          "System",
          "Administrator",
          "Admin",
          "N/A",
          "Admin",
          "Admin Office",
        ],
        function (err) {
          if (err) {
            console.error("Error creating admin account:", err);
          } else {
            console.log("Default admin account created!");
            console.log("Admin Email: admin@uc.ccs");
            console.log("Admin Password: admin123");
          }
        },
      );
    },
  );
}

function createTableAnnouncements() {
  db.run(
    `CREATE TABLE IF NOT EXISTS Annoucements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) `,
  );
}

function createTableSitIn() {
  db.run(
    `CREATE TABLE IF NOT EXISTS sit_in (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            purpose TEXT NOT NULL,
            lab TEXT NOT NULL,
            session INTEGER DEFAULT 1,
            status TEXT DEFAULT 'Active',
            login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            logout_time DATETIME,
            date DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
    (err) => {
      if (err) {
        console.error("Error creating sit_in table:", err);
      } else {
        console.log("Sit_in table ready");
      }
    },
  );
}

function createTableNotifications() {
  db.run(
    `CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'session_ended',
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
    (err) => {
      if (err) {
        console.error("Error creating notifications table:", err);
      } else {
        console.log("Notifications table ready");
      }
    },
  );
}

function createTableReservations() {
  db.run(
    `CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lab TEXT NOT NULL,
            purpose TEXT NOT NULL,
            reservation_date DATE NOT NULL,
            status TEXT DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
    (err) => {
      if (err) {
        console.error("Error creating reservations table:", err);
      } else {
        console.log("Reservations table ready");
      }
    },
  );
}

function addSitInColumns() {
  // Add missing columns to existing sit_in table
  db.run(
    `ALTER TABLE sit_in ADD COLUMN login_time DATETIME DEFAULT CURRENT_TIMESTAMP`,
    (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.log("login_time column may already exist");
      } else {
        console.log("login_time column ready");
      }
    },
  );
  db.run(`ALTER TABLE sit_in ADD COLUMN logout_time DATETIME`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.log("logout_time column may already exist");
    } else {
      console.log("logout_time column ready");
    }
  });
  db.run(
    `ALTER TABLE sit_in ADD COLUMN date DATE DEFAULT CURRENT_DATE`,
    (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.log("date column may already exist");
      } else {
        console.log("date column ready");
      }
    },
  );
}

// Middleware - must be defined BEFORE routes
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Session middleware
app.use(
  session({
    secret: "sit-in-monitor-system-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  }),
);

// API Routes

// Register endpoint
app.post("/api/register", async (req, res) => {
  const { idno, email, password, fname, lname, mname, level, course, address } =
    req.body;

  if (!idno || !email || !password || !fname || !lname) {
    return res
      .status(400)
      .json({ success: false, message: "Please fill in all required fields" });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `INSERT INTO users (idNumber, email, password, firstName, lastName, middleName, courseLevel, course, address, sessionLeft) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 30)`;

    db.run(
      sql,
      [
        idno,
        email,
        hashedPassword,
        fname,
        lname,
        mname || "",
        level || "",
        course || "",
        address || "",
      ],
      function (err) {
        if (err) {
          if (
            err.message.includes("UNIQUE constraint failed") ||
            err.message.includes("UNIQUE")
          ) {
            return res.status(400).json({
              success: false,
              message: "ID Number or Email already exists",
            });
          }
          console.error("Registration error:", err);
          return res
            .status(500)
            .json({ success: false, message: "Registration failed" });
        }

        res.json({
          success: true,
          message: "Registration successful! You can now login.",
        });
      },
    );
  } catch (error) {
    console.error("Hash error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login endpoint
app.post("/api/login", (req, res) => {
  const { idno, password } = req.body;

  if (!idno || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Please enter ID number and password" });
  }

  const sql = "SELECT * FROM users WHERE idNumber = ?";

  db.get(sql, [idno], async (err, user) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid ID number or password" });
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid ID number or password" });
      }

      // Set user session
      req.session.user = {
        id: user.id,
        idNumber: user.idNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        courseLevel: user.courseLevel,
        course: user.course,
        address: user.address,
        profilePic: user.profilePic,
        sessionLeft: user.sessionLeft,
        isAdmin: user.isAdmin === 1,
      };

      res.json({ success: true, message: "Login successful!" });
    } catch (error) {
      console.error("Password compare error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
});

// Get current user endpoint
app.get("/api/user", (req, res) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.status(401).json({ success: false, message: "Not authenticated" });
  }
});

// Logout endpoint
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// Update profile endpoint
app.post("/api/profile/update", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const { firstName, lastName, middleName, courseLevel, course, address } =
    req.body;
  const userId = req.session.user.id;

  const sql = `UPDATE users SET 
    firstName = COALESCE(?, firstName),
    lastName = COALESCE(?, lastName),
    middleName = COALESCE(?, middleName),
    courseLevel = COALESCE(?, courseLevel),
    course = COALESCE(?, course),
    address = COALESCE(?, address)
    WHERE id = ?`;

  db.run(
    sql,
    [firstName, lastName, middleName, courseLevel, course, address, userId],
    function (err) {
      if (err) {
        console.error("Profile update error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Failed to update profile" });
      }

      // Update session with new data
      req.session.user.firstName = firstName || req.session.user.firstName;
      req.session.user.lastName = lastName || req.session.user.lastName;
      req.session.user.middleName = middleName || req.session.user.middleName;
      req.session.user.courseLevel =
        courseLevel || req.session.user.courseLevel;
      req.session.user.course = course || req.session.user.course;
      req.session.user.address = address || req.session.user.address;

      res.json({
        success: true,
        message: "Profile updated successfully",
        user: req.session.user,
      });
    },
  );
});

// Upload profile picture endpoint
app.post(
  "/api/profile/upload",
  upload.single("profilePic"),
  (req, res) => {
    if (!req.session.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const userId = req.session.user.id;
    const profilePicPath = "/uploads/" + req.file.filename;

    // Delete old profile picture if exists
    const selectSql = "SELECT profilePic FROM users WHERE id = ?";
    db.get(selectSql, [userId], (err, row) => {
      if (row && row.profilePic) {
        const oldFilePath = path.join(__dirname, "public", row.profilePic);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Update database with new profile picture
      const updateSql = "UPDATE users SET profilePic = ? WHERE id = ?";
      db.run(updateSql, [profilePicPath, userId], function (err) {
        if (err) {
          console.error("Profile pic update error:", err);
          return res.status(500).json({
            success: false,
            message: "Failed to update profile picture",
          });
        }

        req.session.user.profilePic = profilePicPath;
        res.json({
          success: true,
          message: "Profile picture uploaded successfully",
          profilePic: profilePicPath,
        });
      });
    });
  },
  (error, req, res, next) => {
    res.status(400).json({ success: false, message: error.message });
  },
);

// Middleware
app.use(express.static(path.join(__dirname)));

// Serve Static
app.use(express.static("public"));

initializeDatabase();
createTableAnnouncements();
createTableSitIn();
addSitInColumns();
createTableNotifications();
createTableReservations();
createTableFeedback();

// Feedback API
function createTableFeedback() {
  db.run(
    `CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sit_in_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (sit_in_id) REFERENCES sit_in(id)
        )`,
    function (err) {
      if (err) {
        console.error("Error creating feedback table:", err);
      } else {
        console.log("Feedback table ready");
      }
    },
  );

  // Add sit_in_id column if it doesn't exist
  db.run(`ALTER TABLE feedback ADD COLUMN sit_in_id INTEGER`, function (err) {
    if (err && !err.message.includes("duplicate")) {
      console.log("sit_in_id column may already exist");
    } else {
      console.log("sit_in_id column added");
    }
  });
}

// Submit Feedback API
app.post("/api/feedback", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const { sitInId, message } = req.body;

  if (!sitInId) {
    return res
      .status(400)
      .json({ success: false, message: "Please select a sit-in session" });
  }

  if (!message || message.trim() === "") {
    return res
      .status(400)
      .json({ success: false, message: "Please enter your feedback" });
  }

  const userId = req.session.user.id;
  const sql = `INSERT INTO feedback (user_id, sit_in_id, message) VALUES (?, ?, ?)`;

  db.run(sql, [userId, sitInId, message.trim()], function (err) {
    if (err) {
      console.error("Error submitting feedback:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to submit feedback" });
    }

    res.json({
      success: true,
      message: "Feedback submitted successfully!",
    });
  });
});

// Get All Feedback API (Admin only)
app.get("/api/admin/feedback", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const sql = `
    SELECT 
      f.id,
      f.message,
      f.created_at,
      f.sit_in_id,
      u.idNumber,
      u.firstName,
      u.lastName,
      s.purpose,
      s.lab
    FROM feedback f
    JOIN users u ON f.user_id = u.id
    LEFT JOIN sit_in s ON f.sit_in_id = s.id
    ORDER BY f.created_at DESC
  `;

  db.all(sql, [], function (err, rows) {
    if (err) {
      console.error("Error fetching feedback:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch feedback" });
    }

    res.json({
      success: true,
      feedback: rows,
    });
  });
});

// Announcements API
// Create announcement (admin only)
app.post("/api/announcements", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  // Check if user is admin
  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const { title, description } = req.body;

  if (!title || !description) {
    return res
      .status(400)
      .json({ success: false, message: "Title and description required" });
  }

  const sql = `INSERT INTO Annoucements (title, description) VALUES (?, ?)`;

  db.run(sql, [title, description], function (err) {
    if (err) {
      console.error("Error creating announcement:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to create announcement" });
    }

    res.json({ success: true, message: "Announcement created successfully" });
  });
});

// Get all announcements
app.get("/api/announcements", (req, res) => {
  const sql = `SELECT * FROM Annoucements ORDER BY created_at DESC`;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching announcements:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch announcements" });
    }

    res.json({ success: true, announcements: rows });
  });
});

// Delete announcement (admin only)
app.delete("/api/announcements/:id", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  // Check if user is admin
  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const { id } = req.params;

  const sql = `DELETE FROM Annoucements WHERE id = ?`;

  db.run(sql, [id], function (err) {
    if (err) {
      console.error("Error deleting announcement:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to delete announcement" });
    }

    res.json({ success: true, message: "Announcement deleted successfully" });
  });
});

// ===== Admin Search Student API =====
app.post("/api/admin/search-student", (req, res) => {
  // Check if user is authenticated and is admin
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const { search } = req.body;

  if (!search) {
    return res
      .status(400)
      .json({ success: false, message: "Search term is required" });
  }

  // Search by ID Number or Email
  const sql = `SELECT id, idNumber, email, firstName, lastName, middleName, sessionLeft 
               FROM users 
               WHERE idNumber = ? OR email = ? 
               LIMIT 1`;

  db.get(sql, [search, search], (err, student) => {
    if (err) {
      console.error("Search student error:", err);
      return res.status(500).json({ success: false, message: "Search failed" });
    }

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    res.json({
      success: true,
      student: student,
    });
  });
});

// ===== Admin Get All Students API =====
app.get("/api/admin/students", (req, res) => {
  // Check if user is authenticated and is admin
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const searchTerm = req.query.search;
  let sql;
  let params = [];

  if (searchTerm) {
    sql = `SELECT id, idNumber, firstName, lastName, middleName, courseLevel, course, email, sessionLeft 
           FROM users 
           WHERE isAdmin = 0 
           AND (idNumber LIKE ? OR firstName LIKE ? OR lastName LIKE ? OR course LIKE ?)
           ORDER BY lastName, firstName`;
    const searchPattern = `%${searchTerm}%`;
    params = [searchPattern, searchPattern, searchPattern, searchPattern];
  } else {
    sql = `SELECT id, idNumber, firstName, lastName, middleName, courseLevel, course, email, sessionLeft 
           FROM users 
           WHERE isAdmin = 0
           ORDER BY lastName, firstName`;
  }

  db.all(sql, params, (err, students) => {
    if (err) {
      console.error("Get all students error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to retrieve students" });
    }

    res.json({
      success: true,
      students: students,
    });
  });
});

// ===== Admin Delete Student API =====
app.delete("/api/admin/students/:id", (req, res) => {
  // Check if user is authenticated and is admin
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const studentId = req.params.id;

  const sql = `DELETE FROM users WHERE id = ?`;

  db.run(sql, [studentId], function (err) {
    if (err) {
      console.error("Delete student error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to delete student" });
    }

    res.json({
      success: true,
      message: "Student deleted successfully",
    });
  });
});

// ===== Admin Update Student API =====
app.put("/api/admin/students/:id", (req, res) => {
  // Check if user is authenticated and is admin
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const studentId = req.params.id;
  const {
    idNumber,
    firstName,
    lastName,
    middleName,
    courseLevel,
    course,
    sessionLeft,
  } = req.body;

  const sql = `UPDATE users SET 
               idNumber = COALESCE(?, idNumber),
               firstName = COALESCE(?, firstName),
               lastName = COALESCE(?, lastName),
               middleName = COALESCE(?, middleName),
               courseLevel = COALESCE(?, courseLevel),
               course = COALESCE(?, course),
               sessionLeft = COALESCE(?, sessionLeft)
               WHERE id = ?`;

  db.run(
    sql,
    [
      idNumber,
      firstName,
      lastName,
      middleName,
      courseLevel,
      course,
      sessionLeft,
      studentId,
    ],
    function (err) {
      if (err) {
        console.error("Update student error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Failed to update student" });
      }

      res.json({
        success: true,
        message: "Student updated successfully",
      });
    },
  );
});

// ===== Admin Reset All Sessions API =====
app.post("/api/admin/reset-all-sessions", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const sql = `UPDATE users SET sessionLeft = 30 WHERE isAdmin = 0`;

  db.run(sql, [], function (err) {
    if (err) {
      console.error("Reset all sessions error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to reset sessions" });
    }

    res.json({
      success: true,
      message: "All sessions reset to 30",
    });
  });
});

// ===== Admin Record Sit-in API =====
app.post("/api/admin/sit-in", (req, res) => {
  // Check if user is authenticated and is admin
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const { studentId, purpose, lab } = req.body;

  if (!studentId || !purpose || !lab) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

  // Get current student session info
  const getStudentSql = "SELECT sessionLeft FROM users WHERE id = ?";

  db.get(getStudentSql, [studentId], (err, student) => {
    if (err) {
      console.error("Get student error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get student info" });
    }

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    // Check if student has remaining sessions
    const currentSessions = student.sessionLeft || 30;

    if (currentSessions <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Student has no remaining sessions" });
    }

    // Insert sit-in record (session will be deducted when finished)
    const insertSitInSql = `INSERT INTO sit_in (user_id, purpose, lab, session, status) VALUES (?, ?, ?, 1, 'Active')`;
    db.run(insertSitInSql, [studentId, purpose, lab], function (err) {
      if (err) {
        console.error("Insert sit-in error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Failed to record sit in" });
      }

      console.log("Sit-in record created with ID:", this.lastID);

      res.json({
        success: true,
        message: "Sit in recorded successfully!",
        remainingSessions: currentSessions,
      });
    });
  });
});

// ===== Finish Sit-in API =====
app.post("/api/sit-in/finish", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const { sitInId } = req.body;

  if (!sitInId) {
    return res
      .status(400)
      .json({ success: false, message: "Sit-in ID is required" });
  }

  // First get the sit-in record to find the user
  const getSitInSql = "SELECT user_id, purpose, lab FROM sit_in WHERE id = ?";
  db.get(getSitInSql, [sitInId], (err, sitIn) => {
    if (err) {
      console.error("Get sit-in error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get sit-in" });
    }

    if (!sitIn) {
      return res
        .status(404)
        .json({ success: false, message: "Sit-in not found" });
    }

    // Update status to Finished and add logout time
    const updateSql =
      "UPDATE sit_in SET status = 'Finished', logout_time = CURRENT_TIMESTAMP WHERE id = ?";
    db.run(updateSql, [sitInId], function (err) {
      if (err) {
        console.error("Finish sit-in error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Failed to finish sit-in" });
      }
    });

    // Now decrement the user's session count
    const getUserSql = "SELECT sessionLeft FROM users WHERE id = ?";
    db.get(getUserSql, [sitIn.user_id], (err, user) => {
      if (err) {
        console.error("Get user error:", err);
      } else if (user && user.sessionLeft > 0) {
        const newSessions = user.sessionLeft - 1;
        const updateUserSql = "UPDATE users SET sessionLeft = ? WHERE id = ?";
        db.run(updateUserSql, [newSessions, sitIn.user_id], (err) => {
          if (err) {
            console.error("Update session error:", err);
          } else {
            console.log("Session decremented for user:", sitIn.user_id);
          }
        });
      }
    });

    // Create notification for the user
    const notificationTitle = "Session Ended";
    const notificationMessage = `Your sit-in session for ${sitIn.purpose} in Lab ${sitIn.lab} has been ended by the administrator.`;
    const insertNotificationSql = `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'session_ended')`;
    db.run(
      insertNotificationSql,
      [sitIn.user_id, notificationTitle, notificationMessage],
      (err) => {
        if (err) {
          console.error("Error creating notification:", err);
        } else {
          console.log("Notification created for user:", sitIn.user_id);
        }
      },
    );

    res.json({
      success: true,
      message: "Sit-in finished successfully",
    });
  });
});

// ===== Get All Sit-ins (including finished) API =====
app.get("/api/sit-ins-all", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const sql = `
    SELECT 
      s.id as sit_in_id,
      s.user_id,
      s.purpose,
      s.lab,
      s.session,
      s.status,
      s.created_at as login_time,
      s.created_at as logout_time,
      DATE(s.created_at) as date,
      u.idNumber,
      u.firstName,
      u.lastName
    FROM sit_in s
    JOIN users u ON s.user_id = u.id
    WHERE s.status = 'Finished'
    ORDER BY s.created_at DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Get sit-ins error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get sit-ins" });
    }

    res.json({
      success: true,
      sitIns: rows,
    });
  });
});

// ===== Get Current Sit-ins API =====
app.get("/api/sit-ins", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const sql = `
    SELECT 
      s.id as sit_in_id,
      s.user_id,
      s.purpose,
      s.lab,
      s.session,
      s.status,
      s.created_at as login_time,
      s.created_at as logout_time,
      DATE(s.created_at) as date,
      u.idNumber,
      u.firstName,
      u.lastName
    FROM sit_in s
    JOIN users u ON s.user_id = u.id
    WHERE s.status = 'Active'
    ORDER BY s.created_at DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Get sit-ins error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get sit-ins" });
    }

    res.json({
      success: true,
      sitIns: rows,
    });
  });
});

// ===== Get User's Sit-in History API =====
app.get("/api/user/sit-in-history", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const userId = req.session.user.id;

  const sql = `
    SELECT 
      id,
      purpose,
      lab,
      session,
      status,
      created_at as login_time,
      logout_time,
      DATE(created_at) as date
    FROM sit_in
    WHERE user_id = ? AND status = 'Finished'
    ORDER BY created_at DESC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("Get user sit-in history error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get sit-in history" });
    }

    res.json({
      success: true,
      history: rows,
    });
  });
});

// ===== Get User Notifications API =====
app.get("/api/user/notifications", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const userId = req.session.user.id;

  const sql = `
    SELECT 
      id,
      title,
      message,
      type,
      is_read,
      created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("Get notifications error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get notifications" });
    }

    res.json({
      success: true,
      notifications: rows,
    });
  });
});

// ===== Get Unread Notification Count API =====
app.get("/api/user/notifications/unread-count", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const userId = req.session.user.id;

  const sql = `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`;

  db.get(sql, [userId], (err, row) => {
    if (err) {
      console.error("Get unread notification count error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get notification count" });
    }

    res.json({
      success: true,
      count: row.count,
    });
  });
});

// ===== Mark Notification as Read API =====
app.post("/api/user/notifications/:id/read", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const userId = req.session.user.id;
  const notificationId = req.params.id;

  const sql = `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`;
  db.run(sql, [notificationId, userId], function (err) {
    if (err) {
      console.error("Mark notification as read error:", err);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to mark notification as read",
        });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  });
});

// ===== Mark All Notifications as Read API =====
app.post("/api/user/notifications/read-all", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  const userId = req.session.user.id;

  const sql = `UPDATE notifications SET is_read = 1 WHERE user_id = ?`;
  db.run(sql, [userId], function (err) {
    if (err) {
      console.error("Mark all notifications as read error:", err);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to mark notifications as read",
        });
    }

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  });
});

// ===== Admin Stats API =====
app.get("/api/admin/stats", (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const stats = {};
  
  // Get total students
  db.get("SELECT COUNT(*) as count FROM users WHERE isAdmin = 0", (err, row) => {
    if (err) return res.status(500).json({ success: false, message: "Error fetching student count" });
    stats.totalStudents = row.count;

    // Get active sit-ins
    db.get("SELECT COUNT(*) as count FROM sit_in WHERE status = 'Active'", (err, row) => {
      if (err) return res.status(500).json({ success: false, message: "Error fetching active sit-ins" });
      stats.activeSitIns = row.count;

      // Get total sessions (total finished sit-ins + active)
      db.get("SELECT COUNT(*) as count FROM sit_in", (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "Error fetching total sessions" });
        stats.totalSessions = row.count;

        // Get pending reservations
        db.get("SELECT COUNT(*) as count FROM reservations WHERE status = 'Pending'", (err, row) => {
          if (err) return res.status(500).json({ success: false, message: "Error fetching pending reservations" });
          stats.pendingReservations = row.count;

          res.json({ success: true, stats });
        });
      });
    });
  });
});

// ===== Create Reservation API (Student) =====
app.post("/api/reservations", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const { lab, purpose, reservationDate } = req.body;
  if (!lab || !purpose || !reservationDate) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  const userId = req.session.user.id;
  const sql = `INSERT INTO reservations (user_id, lab, purpose, reservation_date) VALUES (?, ?, ?, ?)`;
  
  db.run(sql, [userId, lab, purpose, reservationDate], function (err) {
    if (err) {
      console.error("Error creating reservation:", err);
      return res.status(500).json({ success: false, message: "Failed to create reservation" });
    }
    res.json({ success: true, message: "Reservation submitted successfully!" });
  });
});

// ===== Get Student Reservations API =====
app.get("/api/user/reservations", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const userId = req.session.user.id;
  const sql = `SELECT * FROM reservations WHERE user_id = ? ORDER BY created_at DESC`;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("Error getting user reservations:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch reservations" });
    }
    res.json({ success: true, reservations: rows });
  });
});

// ===== Get All Pending Reservations API (Admin) =====
app.get("/api/admin/reservations", (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const sql = `
    SELECT 
      r.id, r.user_id, r.lab, r.purpose, r.reservation_date, r.status, r.created_at,
      u.idNumber, u.firstName, u.lastName
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    WHERE r.status = 'Pending'
    ORDER BY r.created_at ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error getting admin reservations:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch reservations" });
    }
    res.json({ success: true, reservations: rows });
  });
});

// ===== Update Reservation Status API (Admin) =====
app.post("/api/admin/reservations/:id/status", (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const reservationId = req.params.id;
  const { status } = req.body;

  if (status !== 'Approved' && status !== 'Declined') {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  // Get reservation first to notify the correct user
  const getSql = `SELECT * FROM reservations WHERE id = ?`;
  db.get(getSql, [reservationId], (err, reservation) => {
    if (err || !reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found" });
    }

    const updateSql = `UPDATE reservations SET status = ? WHERE id = ?`;
    db.run(updateSql, [status, reservationId], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: "Failed to update reservation" });
      }

      // Create Notification
      const title = `Reservation ${status}`;
      const message = `Your reservation request for ${reservation.lab} on ${reservation.reservation_date} for ${reservation.purpose} has been ${status.toLowerCase()}.`;
      const notifSql = `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'reservation_update')`;
      
      db.run(notifSql, [reservation.user_id, title, message]);

      res.json({ success: true, message: `Reservation ${status.toLowerCase()} successfully!` });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
