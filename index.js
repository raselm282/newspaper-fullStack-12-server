const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;
// const corsOptions = {
//   origin: ["http://localhost:5173", "https://assignments12-clients.web.app"],
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true,
// };
const corsOptions = {
  origin: ["https://assignments12-clients.web.app","http://localhost:5173"],
  credentials: true,
  
};
// Middleware
app.use(cors(corsOptions));
// app.use(cors());
app.use(express.json());

// MongoDB URI and client setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yz4tz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect(); // Keep the connection open
    const articlesCollection = client.db("articlesDb").collection("articles");
    const userCollection = client.db("articlesDb").collection("users");
    const publishersCollection = client
      .db("articlesDb")
      .collection("publishers");
    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
    });
    //verifyToken
    const verifyToken = (req, res, next) => {
      // console.log("from verifyToken", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
    
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.isAdmin === true;
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
    //admin checking from useAdmin()
    app.get('/users/adminTrue/:email',verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.isAdmin === true;
      }
      res.send({ admin });
    })
    // stats or analytics
    app.get('/statistics', async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      // const menuItems = await menuCollection.estimatedDocumentCount();
      // const orders = await paymentCollection.estimatedDocumentCount();

      // this is not the best way
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((total, payment) => total + payment.price, 0);

      // const result = await paymentCollection.aggregate([
      //   {
      //     $group: {
      //       _id: null,
      //       totalRevenue: {
      //         $sum: '$price'
      //       }
      //     }
      //   }
      // ]).toArray();

      // const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        // menuItems,
        // orders,
        // revenue
      })
    })
    //get request for publisher of add publisher
    app.get("/publishersData", async (req, res) => {
      const result = await publishersCollection.find().toArray();
      res.send(result);
    });
    //post for publisher from add publisher
    app.post("/addPublisher",verifyToken,verifyAdmin, async (req, res) => {
      // console.log("Received data:", req.body); // Debug
      const item = req.body;
      const result = await publishersCollection.insertOne(item);
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user does not exists:
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // save a jobData in db
    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      const maraData = req.body;
      const updated = {
        $set: maraData,
      };
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const result = await userCollection.updateOne(query, updated, options);
      // console.log(result);
      res.send(result);
    });
    // users related api
    app.get("/usersData", verifyToken,verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.post("/articlesPost", async (req, res) => {
      // console.log("Received data:", req.body); // Debug
      const item = req.body;
      const result = await articlesCollection.insertOne(item);
      res.send(result);
    });
    // Update a article from db/my article page
    app.patch("/articlesUpdateOne/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const { title, image, tags, description } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { title, image, tags, description },
      };
      const result = await articlesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // delete a articles from db/my article page
    app.delete("/articlesDelete/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articlesCollection.deleteOne(query);
      res.send(result);
    });
    //gat all articles data posted by specific user
    app.get("/articles/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email };
      const result = await articlesCollection.find(query).toArray();
      res.send(result);
    });
    //gat all articles data from db for all articles
    app.get("/articles", async (req, res) => {
      const result = await articlesCollection.find().toArray();
      res.send(result);
    });
    // update a articles status from AllArticlesPage
    app.patch("/articlesPremium/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const { isPremium } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { isPremium },
      };
      const result = await articlesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // update a articles status from AllArticlesPage
    app.patch("/articlesStatus/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { status, reason, isPremium } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status, reason, isPremium },
      };
      const result = await articlesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // get a articles by id for details page
    app.get("/articlesDetailsPage/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articlesCollection.findOne(query);
      res.send(result);
    });
    // patch view count articles by id for details page
    app.patch("/viewCount/:id",verifyToken, async (req, res) => {
      const { id } = req.params;
      const { views } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: { views: 1 },
      };
      const articleViewCount = await articlesCollection.updateOne(
        query,
        updateDoc
      );
      res.send(articleViewCount);
    });
   

    // console.log("Connected to MongoDB and ready to accept requests.");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
  
}

run().catch(console.dir)

app.get("/", (req, res) => {
  res.send("my assignments 12 is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
