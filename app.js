require("dotenv").config();
const express = require("express");
const cors = require("cors");

const analyzeRouter = require("./routes/analyze");
const usdaRouter = require("./routes/usda");
const mealsRouter = require("./routes/meals");

const app = express();
// cors
app.use(cors());
// express body-parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/analyze", analyzeRouter);
app.use("/api/usda", usdaRouter);
app.use("/api/meals", mealsRouter);

app.get("/", (req, res) => {
    res.json({ message: "Welcome to MacroSnap!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
