const landingPage = document.getElementById("landingPage");
const registrationPage = document.getElementById("registrationPage");
const loginPage = document.getElementById("loginPage");
const userDashboard = document.getElementById("userDashboard");
const editProfilePage = document.getElementById("editProfilePage");
const adminDashboard = document.getElementById("adminDashboard");

const loginLink = document.getElementById("loginLink");
const backLogin = document.getElementById("backLogin");

const registerLink = document.getElementById("registerLink");
const registerNow = document.getElementById("registerNow");
const backButton = document.getElementById("back");

const registrationForm = document.getElementById("registrationForm");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");

// Edit Profile elements
const editProfileLink = document.getElementById("editProfileLink");
const backToDashboard = document.getElementById("backToDashboard");
const cancelEditProfile = document.getElementById("cancelEditProfile");
const editProfileForm = document.getElementById("editProfileForm");
const profilePicInput = document.getElementById("profilePicInput");
const profilePicPreview = document.getElementById("profilePicPreview");
const logoutBtnEdit = document.getElementById("logoutBtnEdit");

let currentUser = null;

function hideAll() {
  landingPage.style.display = "none";
  registrationPage.style.display = "none";
  loginPage.style.display = "none";
  if (userDashboard) {
    userDashboard.style.display = "none";
  }
  if (editProfilePage) {
    editProfilePage.style.display = "none";
  }
  if (adminDashboard) {
    adminDashboard.style.display = "none";
  }
  if (studentInformationAdmin) {
    studentInformationAdmin.style.display = "none";
  }
}

// Check if user is logged in on page load
async function checkAuth() {
  try {
    const response = await fetch("/api/user");
    const data = await response.json();

    if (data.success) {
      // Check if user is admin
      if (data.user.isAdmin) {
        displayAdminDashboard();
      } else {
        displayUserDashboard(data.user);
      }
    }
  } catch (error) {
    console.error("Auth check failed:", error);
  }
}

// Display admin dashboard
function displayAdminDashboard() {
  hideAll();
  adminDashboard.style.display = "block";
  loadAdminAnnouncements();
  loadStudents();
}

// Student Management Functions
let allStudents = [];

// Load all students
async function loadStudents(searchTerm = "") {
  const tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;

  try {
    const url = searchTerm
      ? `/api/admin/students?search=${encodeURIComponent(searchTerm)}`
      : "/api/admin/students";

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      allStudents = data.students;
      renderStudentsTable(allStudents);
    } else {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">${data.message}</td></tr>`;
    }
  } catch (error) {
    console.error("Error loading students:", error);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error loading students</td></tr>`;
  }
}

// Render students table
function renderStudentsTable(students) {
  const tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;

  if (students.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No students found</td></tr>`;
    return;
  }

  tableBody.innerHTML = students
    .map((student) => {
      const fullName = `${student.lastName}, ${student.firstName}${student.middleName ? " " + student.middleName : ""}`;
      return `
      <tr>
        <td>${student.idNumber || "N/A"}</td>
        <td>${fullName}</td>
        <td>${student.courseLevel || "N/A"}</td>
        <td>${student.course || "N/A"}</td>
        <td>${student.sessionLeft !== null ? student.sessionLeft : 30}</td>
        <td class="action-buttons">
          <button class="edit-btn" onclick="openEditStudentModal(${student.id})">Edit</button>
          <button class="delete-btn" onclick="openDeleteStudentModal(${student.id})">Delete</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

// Open edit student modal
function openEditStudentModal(studentId) {
  const student = allStudents.find((s) => s.id === studentId);
  if (!student) return;

  document.getElementById("editStudentId").value = student.id;
  document.getElementById("editStudentIdNumber").value = student.idNumber || "";
  document.getElementById("editStudentFirstName").value =
    student.firstName || "";
  document.getElementById("editStudentLastName").value = student.lastName || "";
  document.getElementById("editStudentMiddleName").value =
    student.middleName || "";
  document.getElementById("editStudentYearLevel").value =
    student.courseLevel || "";
  document.getElementById("editStudentCourse").value = student.course || "";
  document.getElementById("editStudentSession").value =
    student.sessionLeft !== null ? student.sessionLeft : 30;
  document.getElementById("editStudentMessage").textContent = "";

  document.getElementById("editStudentModal").style.display = "block";
}

// Open delete student modal
function openDeleteStudentModal(studentId) {
  const student = allStudents.find((s) => s.id === studentId);
  if (!student) return;

  document.getElementById("deleteStudentId").value = student.id;
  document.getElementById("deleteStudentName").textContent =
    `${student.firstName} ${student.middleName ? student.middleName + " " : ""}${student.lastName}`;
  document.getElementById("deleteStudentIdNumber").textContent =
    student.idNumber || "N/A";
  document.getElementById("deleteStudentMessage").textContent = "";

  document.getElementById("deleteStudentModal").style.display = "block";
}

// Handle edit student form submission
async function handleEditStudent(e) {
  e.preventDefault();

  const studentId = document.getElementById("editStudentId").value;
  const formData = {
    idNumber: document.getElementById("editStudentIdNumber").value,
    firstName: document.getElementById("editStudentFirstName").value,
    lastName: document.getElementById("editStudentLastName").value,
    middleName: document.getElementById("editStudentMiddleName").value,
    courseLevel: document.getElementById("editStudentYearLevel").value,
    course: document.getElementById("editStudentCourse").value,
    sessionLeft: parseInt(document.getElementById("editStudentSession").value),
  };

  try {
    const response = await fetch(`/api/admin/students/${studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (data.success) {
      document.getElementById("editStudentMessage").style.color = "green";
      document.getElementById("editStudentMessage").textContent = data.message;

      setTimeout(() => {
        document.getElementById("editStudentModal").style.display = "none";
        loadStudents();
      }, 1000);
    } else {
      document.getElementById("editStudentMessage").style.color = "red";
      document.getElementById("editStudentMessage").textContent = data.message;
    }
  } catch (error) {
    console.error("Error updating student:", error);
    document.getElementById("editStudentMessage").style.color = "red";
    document.getElementById("editStudentMessage").textContent =
      "Error updating student";
  }
}

// Handle delete student
async function handleDeleteStudent() {
  const studentId = document.getElementById("deleteStudentId").value;

  try {
    const response = await fetch(`/api/admin/students/${studentId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      document.getElementById("deleteStudentMessage").style.color = "green";
      document.getElementById("deleteStudentMessage").textContent =
        data.message;

      setTimeout(() => {
        document.getElementById("deleteStudentModal").style.display = "none";
        loadStudents();
      }, 1000);
    } else {
      document.getElementById("deleteStudentMessage").style.color = "red";
      document.getElementById("deleteStudentMessage").textContent =
        data.message;
    }
  } catch (error) {
    console.error("Error deleting student:", error);
    document.getElementById("deleteStudentMessage").style.color = "red";
    document.getElementById("deleteStudentMessage").textContent =
      "Error deleting student";
  }
}

// Handle student search
function handleStudentSearch() {
  const searchTerm = document.getElementById("studentSearchInput").value.trim();
  const clearBtn = document.getElementById("clearSearchBtn");

  if (searchTerm) {
    clearBtn.style.display = "inline-block";
    loadStudents(searchTerm);
  } else {
    clearBtn.style.display = "none";
    loadStudents();
  }
}

// Clear student search
function clearStudentSearch() {
  document.getElementById("studentSearchInput").value = "";
  document.getElementById("clearSearchBtn").style.display = "none";
  loadStudents();
}

// Setup student management event listeners
function setupStudentManagement() {
  // Edit student form
  const editStudentForm = document.getElementById("editStudentForm");
  if (editStudentForm) {
    editStudentForm.addEventListener("submit", handleEditStudent);
  }

  // Delete student button
  const confirmDeleteBtn = document.getElementById("confirmDeleteStudent");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", handleDeleteStudent);
  }

  // Search student
  const searchStudentBtn = document.getElementById("searchStudentBtn");
  if (searchStudentBtn) {
    searchStudentBtn.addEventListener("click", handleStudentSearch);
  }

  // Clear search
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", clearStudentSearch);
  }

  // Enter key search
  const searchInput = document.getElementById("studentSearchInput");
  if (searchInput) {
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        handleStudentSearch();
      }
    });
  }

  // Close edit student modal
  const closeEditModal = document.getElementById("closeEditStudentModal");
  if (closeEditModal) {
    closeEditModal.addEventListener("click", function () {
      document.getElementById("editStudentModal").style.display = "none";
    });
  }

  // Close delete student modal
  const closeDeleteModal = document.getElementById("closeDeleteStudentModal");
  if (closeDeleteModal) {
    closeDeleteModal.addEventListener("click", function () {
      document.getElementById("deleteStudentModal").style.display = "none";
    });
  }

  // Cancel delete
  const cancelDeleteBtn = document.getElementById("cancelDeleteStudent");
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", function () {
      document.getElementById("deleteStudentModal").style.display = "none";
    });
  }

  // Close modals when clicking outside
  window.addEventListener("click", function (e) {
    const editModal = document.getElementById("editStudentModal");
    const deleteModal = document.getElementById("deleteStudentModal");

    if (e.target === editModal) {
      editModal.style.display = "none";
    }
    if (e.target === deleteModal) {
      deleteModal.style.display = "none";
    }
  });
}

// Initialize student management on page load
document.addEventListener("DOMContentLoaded", function () {
  setupStudentManagement();
  setupSuccessModals();
});

// Setup success modal event listeners
function setupSuccessModals() {
  // Login success modal
  const loginSuccessModal = document.getElementById("loginSuccessModal");
  const loginSuccessClose = document.getElementById("loginSuccessClose");
  if (loginSuccessClose) {
    loginSuccessClose.addEventListener("click", function () {
      loginSuccessModal.style.display = "none";
    });
  }

  // Register success modal
  const registerSuccessModal = document.getElementById("registerSuccessModal");
  const registerSuccessClose = document.getElementById("registerSuccessClose");
  if (registerSuccessClose) {
    registerSuccessClose.addEventListener("click", function () {
      registerSuccessModal.style.display = "none";
      hideAll();
      loginPage.style.display = "flex";
    });
  }

  // Logout success modal
  const logoutSuccessModal = document.getElementById("logoutSuccessModal");
  const logoutSuccessClose = document.getElementById("logoutSuccessClose");
  if (logoutSuccessClose) {
    logoutSuccessClose.addEventListener("click", function () {
      logoutSuccessModal.style.display = "none";
      hideAll();
      landingPage.style.display = "block";
    });
  }

  // Close modals when clicking outside
  window.addEventListener("click", function (e) {
    if (e.target === loginSuccessModal) {
      loginSuccessModal.style.display = "none";
    }
    if (e.target === registerSuccessModal) {
      registerSuccessModal.style.display = "none";
      hideAll();
      loginPage.style.display = "flex";
    }
    if (e.target === logoutSuccessModal) {
      logoutSuccessModal.style.display = "none";
      hideAll();
      landingPage.style.display = "block";
    }
  });
}

// Show login success modal
function showLoginSuccessModal() {
  const loginSuccessModal = document.getElementById("loginSuccessModal");
  if (loginSuccessModal) {
    loginSuccessModal.style.display = "block";
  }
}

// Show register success modal
function showRegisterSuccessModal() {
  const registerSuccessModal = document.getElementById("registerSuccessModal");
  if (registerSuccessModal) {
    registerSuccessModal.style.display = "block";
  }
}

// Show logout success modal
function showLogoutSuccessModal() {
  const logoutSuccessModal = document.getElementById("logoutSuccessModal");
  if (logoutSuccessModal) {
    logoutSuccessModal.style.display = "block";
  }
}

// Display user information in dashboard
function displayUserDashboard(user) {
  hideAll();
  userDashboard.style.display = "block";

  // Store current user
  currentUser = user;

  // Display user info
  document.getElementById("displayName").textContent =
    `${user.firstName} ${user.middleName ? user.middleName + " " : ""}${user.lastName}`;
  document.getElementById("displayIdNumber").textContent =
    user.idNumber || "N/A";
  document.getElementById("displayCourse").textContent = user.course || "N/A";
  document.getElementById("displayYear").textContent =
    user.courseLevel || "N/A";
  document.getElementById("displayEmail").textContent = user.email;
  document.getElementById("displayAddress").textContent = user.address || "N/A";
  document.getElementById("displaySession").textContent =
    user.sessionLeft !== null ? user.sessionLeft : "30";

  // Display profile picture
  const displayProfilePic = document.getElementById("displayProfilePic");
  if (user.profilePic) {
    displayProfilePic.src = user.profilePic;
  } else {
    displayProfilePic.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cccccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
  }

  // Load announcements for user
  loadUserAnnouncements();
}

// Navigation Event Listeners
registerLink.addEventListener("click", function (e) {
  e.preventDefault();
  hideAll();
  registrationPage.style.display = "flex";
});

registerNow.addEventListener("click", function () {
  hideAll();
  registrationPage.style.display = "flex";
});

backButton.addEventListener("click", function () {
  hideAll();
  landingPage.style.display = "block";
});

loginLink.addEventListener("click", function (e) {
  e.preventDefault();
  hideAll();
  loginPage.style.display = "flex";
});

backLogin.addEventListener("click", function () {
  hideAll();
  landingPage.style.display = "block";
});

// Registration Form Handler
registrationForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const password = document.getElementById("password").value;
  const repassword = document.getElementById("repassword").value;
  const messageEl = document.getElementById("registerMessage");

  // Check if passwords match
  if (password !== repassword) {
    messageEl.textContent = "Passwords do not match!";
    messageEl.style.color = "red";
    return;
  }

  // Check password length
  if (password.length < 6) {
    messageEl.textContent = "Password must be at least 6 characters!";
    messageEl.style.color = "red";
    return;
  }

  const formData = {
    idno: document.getElementById("idno").value,
    fname: document.getElementById("fname").value,
    lname: document.getElementById("lname").value,
    mname: document.getElementById("mname").value,
    level: document.getElementById("level").value,
    email: document.getElementById("email").value,
    course: document.getElementById("course").value,
    address: document.getElementById("address").value,
    password: password,
  };

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (data.success) {
      // Show registration success modal
      showRegisterSuccessModal();

      // Clear form
      registrationForm.reset();
      messageEl.textContent = "";
    } else {
      messageEl.textContent = data.message;
      messageEl.style.color = "red";
    }
  } catch (error) {
    messageEl.textContent = "Registration failed. Please try again.";
    messageEl.style.color = "red";
    console.error("Registration error:", error);
  }
});

// Login Form Handler
loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("loginemail").value;
  const password = document.getElementById("loginpassword").value;
  const messageEl = document.getElementById("loginMessage");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      messageEl.textContent = "";
      // Show login success modal first
      showLoginSuccessModal();

      // Fetch user data and show dashboard after a short delay
      const userResponse = await fetch("/api/user");
      const userData = await userResponse.json();

      if (userData.success) {
        // Check if user is admin
        if (userData.user.isAdmin) {
          displayAdminDashboard();
        } else {
          displayUserDashboard(userData.user);
        }
      }

      // Clear login form
      loginForm.reset();
    } else {
      messageEl.textContent = data.message;
    }
  } catch (error) {
    messageEl.textContent = "Login failed. Please try again.";
    console.error("Login error:", error);
  }
});

// Logout Handler
logoutBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  try {
    await fetch("/api/logout", {
      method: "POST",
    });

    // Show logout success modal
    showLogoutSuccessModal();
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// Edit Profile Page Handlers
editProfileLink.addEventListener("click", function (e) {
  e.preventDefault();
  openEditProfilePage();
});

backToDashboard.addEventListener("click", function (e) {
  e.preventDefault();
  goToDashboard();
});

cancelEditProfile.addEventListener("click", function () {
  goToDashboard();
});

// Also handle logout from edit profile page
if (logoutBtnEdit) {
  logoutBtnEdit.addEventListener("click", async function (e) {
    e.preventDefault();
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
      // Show logout success modal
      showLogoutSuccessModal();
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}

// Admin logout handler
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
      // Show logout success modal
      showLogoutSuccessModal();
    } catch (error) {
      console.error("Admin logout error:", error);
    }
  });
}

// Student Admin Navbar Handlers
const backToAdminFromStudents = document.getElementById(
  "backToAdminFromStudents",
);
const studentAdminLogoutBtn = document.getElementById("studentAdminLogoutBtn");

if (backToAdminFromStudents) {
  backToAdminFromStudents.addEventListener("click", function (e) {
    e.preventDefault();
    displayAdminDashboard();
  });
}

if (studentAdminLogoutBtn) {
  studentAdminLogoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
      // Show logout success modal
      showLogoutSuccessModal();
    } catch (error) {
      console.error("Student admin logout error:", error);
    }
  });
}

// Announcement functionality
const announcementForm = document.getElementById("announcementForm");
if (announcementForm) {
  announcementForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const title = document.getElementById("announcementTitle").value;
    const description = document.getElementById("announcementDesc").value;
    const messageEl = document.getElementById("announcementMessage");

    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description }),
      });

      const data = await response.json();

      if (data.success) {
        messageEl.textContent = "Announcement sent successfully!";
        messageEl.style.color = "green";
        announcementForm.reset();
        loadAdminAnnouncements();
        loadUserAnnouncements();
        setTimeout(() => {
          messageEl.textContent = "";
        }, 3000);
      } else {
        messageEl.textContent = data.message;
        messageEl.style.color = "red";
      }
    } catch (error) {
      messageEl.textContent = "Failed to send announcement";
      messageEl.style.color = "red";
      console.error("Announcement error:", error);
    }
  });
}

// Load announcements for admin
async function loadAdminAnnouncements() {
  const listEl = document.getElementById("adminAnnouncementList");
  if (!listEl) return;

  try {
    const response = await fetch("/api/announcements");
    const data = await response.json();

    if (data.success && data.announcements.length > 0) {
      listEl.innerHTML = data.announcements
        .map(
          (ann) => `
        <div class="announcement-item">
          <div class="announcement-title">${escapeHtml(ann.title)}</div>
          <div class="announcement-desc">${escapeHtml(ann.description)}</div>
          <div class="announcement-date">${new Date(ann.created_at).toLocaleString()}</div>
          <button class="delete-btn" onclick="deleteAnnouncement(${ann.id})">Delete</button>
        </div>
      `,
        )
        .join("");
    } else {
      listEl.innerHTML =
        "<p style='color: #666; font-size: 12px;'>No announcements yet</p>";
    }
  } catch (error) {
    console.error("Error loading admin announcements:", error);
  }
}

// Load announcements for users
async function loadUserAnnouncements() {
  const listEl = document.getElementById("userAnnouncementList");
  if (!listEl) return;

  try {
    const response = await fetch("/api/announcements");
    const data = await response.json();

    if (data.success && data.announcements.length > 0) {
      listEl.innerHTML = data.announcements
        .map(
          (ann) => `
        <div class="announcement-item">
          <div class="announcement-title">${escapeHtml(ann.title)}</div>
          <div class="announcement-desc">${escapeHtml(ann.description)}</div>
          <div class="announcement-date">${new Date(ann.created_at).toLocaleString()}</div>
        </div>
      `,
        )
        .join("");
    } else {
      listEl.innerHTML =
        "<p style='color: #666; font-size: 12px;'>No announcements</p>";
    }
  } catch (error) {
    console.error("Error loading user announcements:", error);
  }
}

// Delete announcement
async function deleteAnnouncement(id) {
  if (!confirm("Are you sure you want to delete this announcement?")) return;

  try {
    const response = await fetch(`/api/announcements/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      loadAdminAnnouncements();
      loadUserAnnouncements();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error("Error deleting announcement:", error);
  }
}

// Make deleteAnnouncement available globally
window.deleteAnnouncement = deleteAnnouncement;

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Load announcements when dashboards are displayed

// Open edit profile page and populate fields
function openEditProfilePage() {
  if (!currentUser) return;

  // Populate form fields
  document.getElementById("editIdno").value = currentUser.idNumber || "";
  document.getElementById("editLname").value = currentUser.lastName || "";
  document.getElementById("editFname").value = currentUser.firstName || "";
  document.getElementById("editMname").value = currentUser.middleName || "";
  document.getElementById("editLevel").value = currentUser.courseLevel || "";
  document.getElementById("editCourse").value = currentUser.course || "";
  document.getElementById("editEmail").value = currentUser.email || "";
  document.getElementById("editAddress").value = currentUser.address || "";

  // Set profile picture preview
  if (currentUser.profilePic) {
    profilePicPreview.src = currentUser.profilePic;
  } else {
    profilePicPreview.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cccccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
  }

  // Clear message
  document.getElementById("editProfileMessage").textContent = "";

  hideAll();
  editProfilePage.style.display = "block";
}

// Navigate back to dashboard
function goToDashboard() {
  // Check if user is admin
  if (currentUser && currentUser.isAdmin) {
    displayAdminDashboard();
  } else {
    displayUserDashboard(currentUser);
  }
}

// Profile picture preview
profilePicInput.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      profilePicPreview.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Edit profile form submit
editProfileForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const messageEl = document.getElementById("editProfileMessage");
  messageEl.textContent = "Saving...";
  messageEl.style.color = "blue";

  // First, upload profile picture if selected
  if (profilePicInput.files.length > 0) {
    const formData = new FormData();
    formData.append("profilePic", profilePicInput.files[0]);

    try {
      const picResponse = await fetch("/api/profile/upload", {
        method: "POST",
        body: formData,
      });

      const picData = await picResponse.json();
      if (picData.success) {
        // Update current user with new profile pic
        currentUser.profilePic = picData.profilePic;
      } else {
        console.error("Profile picture upload failed:", picData.message);
        // Continue with profile update even if picture upload fails
      }
    } catch (error) {
      console.error("Profile picture upload error:", error);
      // Continue with profile update even if picture upload fails
    }
  }

  // Then update profile info
  const formData = {
    firstName: document.getElementById("editFname").value,
    lastName: document.getElementById("editLname").value,
    middleName: document.getElementById("editMname").value,
    courseLevel: document.getElementById("editLevel").value,
    course: document.getElementById("editCourse").value,
    address: document.getElementById("editAddress").value,
  };

  try {
    const response = await fetch("/api/profile/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (data.success) {
      messageEl.textContent = "Profile updated successfully!";
      messageEl.style.color = "green";

      // Update current user
      currentUser = data.user;

      // Go back to dashboard after 1.5 seconds
      setTimeout(() => {
        profilePicInput.value = ""; // Reset file input
        goToDashboard();
      }, 1500);
    } else {
      messageEl.textContent = data.message;
      messageEl.style.color = "red";
    }
  } catch (error) {
    console.error("Profile update error:", error);
    messageEl.textContent = "Failed to update profile. Please try again.";
    messageEl.style.color = "red";
  }
});

// ===== Admin Search and Sit-in Functionality =====

// Modal elements
const searchStudentModal = document.getElementById("searchStudentModal");
const sitInFormModal = document.getElementById("sitInFormModal");
const closeSearchModal = document.getElementById("closeSearchModal");
const closeSitInModal = document.getElementById("closeSitInModal");
const adminSearchLink = document.getElementById("adminSearchLink");
const adminStudentsLink = document.getElementById("adminStudentsLink");
const searchStudentForm = document.getElementById("searchStudentForm");
const sitInForm = document.getElementById("sitInForm");
const studentInformationAdmin = document.querySelector(
  ".student-information-admin",
);

// Store searched student data
let searchedStudent = null;

// Open Search Student modal when clicking Search nav link
if (adminSearchLink) {
  adminSearchLink.addEventListener("click", function (e) {
    e.preventDefault();
    openSearchModal();
  });
}

// Show Student Information Admin when clicking Students nav link
if (adminStudentsLink) {
  adminStudentsLink.addEventListener("click", function (e) {
    e.preventDefault();
    showStudentInformationAdmin();
  });
}

// Function to show student information admin section
function showStudentInformationAdmin() {
  hideAll();
  if (studentInformationAdmin) {
    studentInformationAdmin.style.display = "block";
    loadStudents();
  }
}

// Function to open search modal
function openSearchModal() {
  searchStudentModal.style.display = "block";
  document.getElementById("searchInput").value = "";
  document.getElementById("searchMessage").textContent = "";
}

// Function to close search modal
function closeSearchModalFunc() {
  searchStudentModal.style.display = "none";
}

// Function to open Sit in Form modal
function openSitInModal() {
  sitInFormModal.style.display = "block";
  document.getElementById("sitInMessage").textContent = "";
}

// Function to close Sit in Form modal
function closeSitInModalFunc() {
  sitInFormModal.style.display = "none";
  sitInForm.reset();
  searchedStudent = null;
}

// Close modal event listeners
if (closeSearchModal) {
  closeSearchModal.addEventListener("click", closeSearchModalFunc);
}

if (closeSitInModal) {
  closeSitInModal.addEventListener("click", closeSitInModalFunc);
}

// Add cancel button event listener for Sit in Form
const cancelSitInBtn = document.getElementById("cancelSitInBtn");
if (cancelSitInBtn) {
  cancelSitInBtn.addEventListener("click", closeSitInModalFunc);
}

// Search Student form submit
if (searchStudentForm) {
  searchStudentForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const searchInput = document.getElementById("searchInput").value.trim();
    const messageEl = document.getElementById("searchMessage");

    if (!searchInput) {
      messageEl.textContent = "Please enter ID Number or Email";
      messageEl.className = "error";
      return;
    }

    messageEl.textContent = "Searching...";
    messageEl.className = "";

    try {
      const response = await fetch("/api/admin/search-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ search: searchInput }),
      });

      const data = await response.json();

      if (data.success) {
        searchedStudent = data.student;

        // Populate Sit in Form
        document.getElementById("sitInIdNumber").value =
          searchedStudent.idNumber;
        document.getElementById("sitInStudentName").value =
          searchedStudent.firstName +
          (searchedStudent.middleName ? " " + searchedStudent.middleName : "") +
          " " +
          searchedStudent.lastName;

        // Display remaining sessions (default 30 if null)
        const remainingSessions = searchedStudent.sessionLeft || 30;
        document.getElementById("sitInRemainingSessions").textContent =
          remainingSessions;

        // Close search modal and open sit in form modal
        closeSearchModalFunc();
        openSitInModal();
      } else {
        messageEl.textContent = data.message;
        messageEl.className = "error";
      }
    } catch (error) {
      console.error("Search error:", error);
      messageEl.textContent = "Search failed. Please try again.";
      messageEl.className = "error";
    }
  });
}

// Sit in Form submit
if (sitInForm) {
  sitInForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!searchedStudent) {
      alert("No student selected. Please search for a student first.");
      return;
    }

    const purpose = document.getElementById("sitInPurpose").value;
    const lab = document.getElementById("sitInLab").value;
    const messageEl = document.getElementById("sitInMessage");

    if (!purpose || !lab) {
      messageEl.textContent = "Please select Purpose and Lab";
      messageEl.className = "error";
      return;
    }

    messageEl.textContent = "Processing...";
    messageEl.className = "";

    try {
      const response = await fetch("/api/admin/sit-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: searchedStudent.id,
          purpose: purpose,
          lab: lab,
        }),
      });

      const data = await response.json();

      if (data.success) {
        messageEl.textContent = "Sit in recorded successfully!";
        messageEl.className = "success";

        // Update remaining sessions display
        document.getElementById("sitInRemainingSessions").textContent =
          data.remainingSessions;

        // Reset form after short delay and close
        setTimeout(() => {
          closeSitInModalFunc();
        }, 1500);
      } else {
        messageEl.textContent = data.message;
        messageEl.className = "error";
      }
    } catch (error) {
      console.error("Sit in error:", error);
      messageEl.textContent = "Failed to record sit in. Please try again.";
      messageEl.className = "error";
    }
  });
}

// Initialize - check auth status on page load
checkAuth();
