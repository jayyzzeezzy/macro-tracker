require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
// cors
app.use(cors());
// express body-parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.json({ message: "Welcome to Macro Tracker!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
