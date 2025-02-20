
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const { createServer } = require("http");
const { Server } = require("socket.io");


const port = process.env.PORT || 5000;
const app = express();
const httpServer = createServer(app);
//
// Middleware
const corsOptions = {
  origin: [
    "http://localhost:5173",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-requested-with"],
  exposedHeaders: ["set-cookie"],
  optionsSuccessStatus: 200,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const io = new Server(httpServer, {
    cors: corsOptions
  });

 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ayjrc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10,
  connectTimeoutMS: 5000,
  retryWrites: true,
  retryReads: true
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("TaskMateDB");
    const usersCollection = db.collection("users");
    const taskCollection = db.collection("taskCollection");

  // middleware
  const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    // console.log("Token from cookies:", req.cookies?.token);
    if (!token) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET , (err, decoded) => {
      if (err) {
        // console.error("JWT Error:", err.message);
        return res.status(401).send({ message: "Unauthorized access" });
      }
      req.decoded = decoded; // Set req.decoded instead of req.user
      next();
    });
  };
  const validateObjectId = (req, res, next) => {
    const { id } = req.params;
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ 
            error: "Invalid task ID",
            details: "Task ID must be a valid MongoDB ObjectId"
        });
    }
    next();
};
      // Generate JWT token
          app.post("/jwt", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }
    
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "365d",
        });
    
        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/"
          })
          .json({ success: true });
      } catch (error) {
        console.error("JWT Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

       // Logout
    app.get("/logout", async (req, res) => {
        try {
          res
            .clearCookie("token", {
              httpOnly: true,
              maxAge: 0,
              secure: process.env.NODE_ENV === "production",
              sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            })
            .send({ success: true });
        } catch (err) {
          res.status(500).send(err);
        }
      });


  
    // Post user info
    app.post("/users", async (req, res) => {
        const user = req.body;
        const query = { email: user.email };
        const exist = await usersCollection.findOne(query);
        if (exist) {
          return res.send({ message: "User already exists", insertedId: null });
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
      });
  
      // get all data by email

              // Get tasks for a specific user
        app.get("/tasks/:email", verifyToken, async (req, res) => {
            try {
                const { email } = req.params;
                // Verify the requesting user can only access their own tasks
                if (email !== req.decoded.email) {
                    return res.status(403).json({ error: "You can only access your own tasks" });
                }
        
                const tasks = await taskCollection.find({ userId: email }).toArray();
                res.send(tasks);
            } catch (error) {
                console.error("Error fetching tasks:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
    
      // Add a new task
      app.post("/tasks", verifyToken, async (req, res) => {
        const { title, description, category } = req.body;
        if (!title || title.length > 50) return res.status(400).json({ error: "Invalid title" });
        if (description && description.length > 200) return res.status(400).json({ error: "Description too long" });
  
        const newTask = {
          userId: req.decoded.email,
          title,
          description,
          category: category || "To-Do",
          createdAt: new Date(),
        };
  
        const result = await taskCollection.insertOne(newTask);
        io.emit(`task-updated-${req.decoded.email}`);
        res.json({ ...newTask, _id: result.insertedId });
      });
  
     
    app.put("/tasks/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { title, description, category } = req.body;
        const updateFields = {};
    
        if (title && title.length <= 50) updateFields.title = title;
        if (description && description.length <= 200) updateFields.description = description;
        if (category) updateFields.category = category;
    
        const result = await taskCollection.updateOne(
          { _id: new ObjectId(id), userId: req.decoded.email },
          { $set: updateFields }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).json({ 
            error: "Task not found",
            details: `No task found with ID: ${id} for user: ${req.decoded.email}`
          });
        }
    
        io.emit(`task-updated-${req.decoded.email}`);
        res.json({ message: "Task updated", taskId: id });
      } catch (error) {
        console.error("Error updating task:", error);
        if (error.name === 'BSONTypeError') {
          return res.status(400).json({ error: "Invalid task ID format" });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    });


app.patch("/tasks/:id", verifyToken,validateObjectId, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate if id exists
        if (!id) {
            return res.status(400).json({ error: "Task ID is required" });
        }

        // Validate if id is a valid ObjectId
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid task ID format" });
        }

        const { title, description, category } = req.body;
        const updateFields = {};

        if (title && title.length <= 50) updateFields.title = title;
        if (description && description.length <= 200) updateFields.description = description;
        if (category) updateFields.category = category;

        const result = await taskCollection.updateOne(
            { _id: new ObjectId(id), userId: req.decoded.email },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                error: "Task not found",
                details: `No task found with ID: ${id} for user: ${req.decoded.email}`
            });
        }

        io.emit(`task-updated-${req.decoded.email}`);
        res.json({ 
            message: "Task updated",
            taskId: id,
            updatedFields: updateFields
        });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ 
            error: "Internal server error",
            details: error.message
        });
    }
});


      // Delete a task
      app.delete("/tasks/:id", verifyToken, async (req, res) => {
        const { id } = req.params;
        await taskCollection.deleteOne({ _id: new ObjectId(id), userId: req.decoded.email });
        io.emit(`task-updated-${req.decoded.email}`);
        res.json({ message: "Task deleted" });
      });









    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("Client connected");
  
    socket.on("join-room", (userId) => {
      socket.join(userId);
    });
  
    socket.on("disconnect", () => console.log("Client disconnected"));
  });

app.get("/", (req, res) => {
    res.send("Hello from TaskMate Server..");
  });
  

httpServer.listen(port, () => {
    console.log(`TaskMate is running on port ${port}`);
  });