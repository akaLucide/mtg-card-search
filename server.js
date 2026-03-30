const express = require("express");
const cors = require("cors");
const SERVER_CONFIG = require("./server/config");
const { registerRoutes } = require("./server/routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("."));

registerRoutes(app);

app.listen(SERVER_CONFIG.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${SERVER_CONFIG.PORT}`);
  console.log(`📊 API available at http://localhost:${SERVER_CONFIG.PORT}/api/`);
});
