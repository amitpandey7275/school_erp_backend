// ----------------------- IMPORTS ----------------------------
const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const app = express();

app.use(express.json());
app.use("/uploads", express.static("uploads"));   // Image/PDF folder

// ----------------------- DATABASE ----------------------------
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "@Amit7275#",
    database: "school_erp"
});

db.connect(err => {
    if (err) console.log(err);
    else console.log("MySQL Connected Successfully!");
});

// ----------------------- MULTER CONFIG ----------------------------
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// PDF uploaders
const uploadNotes = multer({ storage });
const uploadTimeTable = multer({ storage });

// ----------------------- REGISTER API ----------------------------
app.post("/register", (req, res) => {
    const { name, email, password, role } = req.body;

    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";

    db.query(sql, [name, email, password, role], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "User Registered", userId: result.insertId });
    });
});



// .....................LOGIN API..........
app.post("/login", (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: "Missing fields" });
    }

    const sql = "SELECT * FROM users WHERE email = ? AND role = ?";

    db.query(sql, [email, role], (err, results) => {
        if (err) return res.status(500).json({ error: err });

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        return res.json({
            message: "Login success",
            id: user.id,
            name: user.name,
            role: user.role,
            class: user.class
        });
    });
});





// ----------------------- UPLOAD EVENT ----------------------------
app.post("/upload_event", upload.single("image"), (req, res) => {
    const { title, desc } = req.body;

    if (!req.file) return res.status(400).json({ error: "Image missing" });

    const imageUrl = `http://172.168.26.158:3000/uploads/${req.file.filename}`;

    const sql = "INSERT INTO events (title, description, image, time) VALUES (?, ?, ?, ?)";

    db.query(sql, [title, desc, imageUrl, Date.now()], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Event Uploaded!", eventId: result.insertId });
    });
});

// ----------------------- UPLOAD NOTICE ----------------------------
app.post("/upload_notice", (req, res) => {
    const { title, desc } = req.body;

    const sql = "INSERT INTO notices (title, description, time) VALUES (?, ?, ?)";

    db.query(sql, [title, desc, Date.now()], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Notice Uploaded!", noticeId: result.insertId });
    });
});

// ----------------------- ADD STUDENT ----------------------------
app.post("/add_student", (req, res) => {
    const { name, email, phone, cls, pass } = req.body;

    const sql = "INSERT INTO students (name, email, phone, class, password) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, [name, email, phone, cls, pass], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Student Added!", studentId: result.insertId });
    });
});

// ----------------------- ADD TEACHER ----------------------------
app.post("/add_teacher", (req, res) => {
    const { name, email, phone, pass } = req.body;

    const sql = "INSERT INTO teachers (name, email, phone, password, createdAt) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, [name, email, phone, pass, Date.now()], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Teacher Added!", teacherId: result.insertId });
    });
});

// ----------------------- GET TEACHERS ----------------------------
app.get("/get_teachers", (req, res) => {
    db.query("SELECT * FROM teachers ORDER BY name ASC", (err, rows) => {
        if (err) return res.status(500).json({ error: err });

        res.json(rows);
    });
});

// ----------------------- DELETE TEACHER ----------------------------
app.post("/delete_teacher", (req, res) => {
    const { id } = req.body;

    db.query("DELETE FROM teachers WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Teacher Deleted" });
    });
});

// ----------------------- TEACHER ATTENDANCE ----------------------------
app.post("/submit_teacher_attendance", (req, res) => {
    const { attendance, time } = req.body;

    const sql = "INSERT INTO teacher_attendance (time, data) VALUES (?, ?)";

    db.query(sql, [time, JSON.stringify(attendance)], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Attendance Saved" });
    });
});

// ----------------------- UPLOAD EXAM ----------------------------
app.post("/upload_exam", (req, res) => {
    const { cls, subj, title, date, desc } = req.body;

    const sql = "INSERT INTO exams (class, subject, title, date, description, time) VALUES (?, ?, ?, ?, ?, ?)";

    db.query(sql, [cls, subj, title, date, desc, Date.now()], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Exam Uploaded!" });
    });
});

// ----------------------- GALLERY UPLOAD ----------------------------
const uploadGallery = multer({ storage });

app.post("/upload_gallery", uploadGallery.array("images", 10), (req, res) => {
    if (!req.files) return res.status(400).json({ error: "Images missing" });

    let values = req.files.map(f => [
        `http://172.168.26.158:3000/uploads/${f.filename}`,
        Date.now()
    ]);

    const sql = "INSERT INTO gallery (imageUrl, time) VALUES ?";

    db.query(sql, [values], err => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Gallery Uploaded!" });
    });
});

// ----------------------- UPLOAD NOTES ----------------------------
app.post("/upload_notes", uploadNotes.single("pdf"), (req, res) => {
    const { title, cls } = req.body;

    const pdfUrl = `http://172.168.26.158:3000/uploads/${req.file.filename}`;

    const sql = "INSERT INTO notes (class, title, pdfUrl, time) VALUES (?, ?, ?, ?)";

    db.query(sql, [cls, title, pdfUrl, Date.now()], err => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "Notes Uploaded!" });
    });
});

// ----------------------- UPLOAD TIMETABLE ----------------------------
app.post("/upload_timetable", uploadTimeTable.single("pdf"), (req, res) => {
    const { cls } = req.body;

    const pdfUrl = `http://172.168.26.158:3000/uploads/${req.file.filename}`;

    const sql = "INSERT INTO timetable (class, pdfUrl, time) VALUES (?, ?, ?)";

    db.query(sql, [cls, pdfUrl, Date.now()], err => {
        if (err) return res.status(500).json({ error: err });

        res.json({ message: "TimeTable Uploaded!" });
    });
});

// ----------------------- GET NOTICES ----------------------------
app.get("/get_notices", (req, res) => {
    db.query("SELECT * FROM notices ORDER BY time DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err });

        res.json(rows);
    });
});

// ----------------------- START SERVER ----------------------------
app.listen(3000,"0.0.0.0", () => {
    console.log("Server running on port 3000");
});









