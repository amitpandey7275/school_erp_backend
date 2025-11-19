// ------------------------------------------------------
//  IMPORTS
// ------------------------------------------------------
const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));  // Host uploaded files


// ------------------------------------------------------
//  CONNECT MYSQL (Railway ENV Variables)
// ------------------------------------------------------
const db = mysql.createPool({
    host: process.env.DB_HOST,      // ballast.proxy.rlwy.net
    user: process.env.DB_USER,      // root
    password: process.env.DB_PASS,  // Railway password
    database: process.env.DB_NAME,  // railway
    port: process.env.DB_PORT       // 23906
});

db.getConnection((err, c) => {
    if (err) {
        console.log("MySQL Error:", err);
    } else {
        console.log("Connected to Railway MySQL");
        c.release();
    }
});


// ------------------------------------------------------
//  MULTER (Uploads to /uploads folder)
// ------------------------------------------------------
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });


// ------------------------------------------------------
//  BASE URL FOR FILES (Render URL)
// ------------------------------------------------------
const BASE_URL = "https://YOUR-RENDER-URL.onrender.com/uploads/";


// ------------------------------------------------------
//  REGISTER USER
// ------------------------------------------------------
app.post("/register", (req, res) => {
    const { name, email, password, role } = req.body;

    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, email, password, role], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ message: "User Registered", id: result.insertId });
    });
});


// ------------------------------------------------------
//  LOGIN
// ------------------------------------------------------
app.post("/login", (req, res) => {
    const { email, password, role } = req.body;

    const sql = "SELECT * FROM users WHERE email = ? AND role = ?";
    db.query(sql, [email, role], (err, rows) => {
        if (err) return res.json({ error: err });

        if (rows.length === 0) {
            return res.json({ message: "Invalid email/role", success: false });
        }

        const user = rows[0];

        if (user.password !== password) {
            return res.json({ message: "Invalid password", success: false });
        }

        res.json({
            success: true,
            id: user.id,
            name: user.name,
            role: user.role
        });
    });
});


// ------------------------------------------------------
//  ADD STUDENT
// ------------------------------------------------------
app.post("/add_student", (req, res) => {
    const { name, email, phone, cls, pass } = req.body;

    const sql = "INSERT INTO students (name, email, phone, class, password) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [name, email, phone, cls, pass], (err, result) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Student Added" });
    });
});


// ------------------------------------------------------
//  ADD TEACHER
// ------------------------------------------------------
app.post("/add_teacher", (req, res) => {
    const { name, email, phone, pass } = req.body;

    const sql = "INSERT INTO teachers (name, email, phone, password) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, email, phone, pass], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Teacher Added" });
    });
});


// ------------------------------------------------------
//  GET TEACHERS
// ------------------------------------------------------
app.get("/get_teachers", (req, res) => {
    db.query("SELECT * FROM teachers ORDER BY name ASC", (err, rows) => {
        if (err) return res.json({ error: err });
        res.json(rows);
    });
});


// ------------------------------------------------------
//  DELETE TEACHER
// ------------------------------------------------------
app.post("/delete_teacher", (req, res) => {
    db.query("DELETE FROM teachers WHERE id = ?", [req.body.id], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Teacher Deleted" });
    });
});


// ------------------------------------------------------
//  UPLOAD EVENT
// ------------------------------------------------------
app.post("/upload_event", upload.single("image"), (req, res) => {
    if (!req.file) return res.json({ error: "Image missing" });

    const imageUrl = BASE_URL + req.file.filename;

    const sql = "INSERT INTO events (title, description, image, time) VALUES (?, ?, ?, ?)";
    db.query(sql, [req.body.title, req.body.desc, imageUrl, Date.now()], (err) => {
        if (err) return res.json({ error: err });

        res.json({ message: "Event Uploaded!" });
    });
});


// ------------------------------------------------------
//  UPLOAD NOTICE
// ------------------------------------------------------
app.post("/upload_notice", (req, res) => {
    const { title, desc } = req.body;
    const sql = "INSERT INTO notices (title, description, time) VALUES (?, ?, ?)";
    db.query(sql, [title, desc, Date.now()], (err) => {
        if (err) return res.json({ error: err });
        res.json({ message: "Notice Uploaded" });
    });
});


// ------------------------------------------------------
//  UPLOAD GALLERY
// ------------------------------------------------------
app.post("/upload_gallery", upload.array("images", 10), (req, res) => {
    if (!req.files) return res.json({ error: "Images missing" });

    const values = req.files.map(f => [BASE_URL + f.filename, Date.now()]);

    const sql = "INSERT INTO gallery (imageUrl, time) VALUES ?";
    db.query(sql, [values], (err) => {
        if (err) return res.json({ error: err });

        res.json({ message: "Gallery Uploaded!" });
    });
});


// ------------------------------------------------------
//  UPLOAD NOTES (PDF)
// ------------------------------------------------------
app.post("/upload_notes", upload.single("pdf"), (req, res) => {
    const pdfUrl = BASE_URL + req.file.filename;

    const sql = "INSERT INTO notes (class, title, pdfUrl, time) VALUES (?, ?, ?, ?)";
    db.query(sql, [req.body.cls, req.body.title, pdfUrl, Date.now()], (err) => {
        if (err) return res.json({ error: err });

        res.json({ message: "Notes Uploaded!" });
    });
});


// ------------------------------------------------------
//  UPLOAD TIMETABLE
// ------------------------------------------------------
app.post("/upload_timetable", upload.single("pdf"), (req, res) => {
    const pdfUrl = BASE_URL + req.file.filename;

    const sql = "INSERT INTO timetable (class, pdfUrl, time) VALUES (?, ?, ?)";
    db.query(sql, [req.body.cls, pdfUrl, Date.now()], (err) => {
        if (err) return res.json({ error: err });

        res.json({ message: "Timetable Uploaded!" });
    });
});


// ------------------------------------------------------
//  START SERVER
// ------------------------------------------------------
app.listen(3000, "0.0.0.0", () => {
    console.log("Server running...");
});
