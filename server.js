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
    "SELECT id FROM users WHERE email = ?",
    [adminEmail],
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
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Please enter email and password" });
  }

  const sql = "SELECT * FROM users WHERE email = ?";

  db.get(sql, [email], async (err, user) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid email or password" });
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

    // Decrease session count
    const newSessions = currentSessions - 1;

    // Update student session
    const updateSql = "UPDATE users SET sessionLeft = ? WHERE id = ?";

    db.run(updateSql, [newSessions, studentId], function (err) {
      if (err) {
        console.error("Update session error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Failed to update sessions" });
      }

      // Also create a sit-in record (optional - if you have a sit_in table)
      // For now, just return success with remaining sessions

      res.json({
        success: true,
        message: "Sit in recorded successfully!",
        remainingSessions: newSessions,
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
