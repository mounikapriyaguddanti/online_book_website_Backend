

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection string
const db = "mongodb+srv://mounikapriyaguddanti:jSm1hOv8mJylaDIH@cluster0.eviujnw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB
mongoose.connect(db)
  .then(() => {
    console.log("Connection to MongoDB successful");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB:", err);
  });

// User schema definition
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, enum: ['user', 'admin'], default: 'user' },
  registeredOn: { type: Date, default: Date.now },  // When user registered
  loginHistory: [{ 
    loginTime: { type: Date },
    logoutTime: { type: Date }
  }]
});

const User = mongoose.model('User', userSchema);

// Registration route
app.post('/register', async (req, res) => {
  const { fullName, email, phoneNumber, username, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Determine user type based on email domain
    const userType = email.endsWith('@numetry.com') ? 'admin' : 'user';

    const newUser = await User.create({
      fullName,
      email,
      phoneNumber,
      username,
      password,  
      userType,
      registeredOn: new Date()
    });

    res.json({ message: "Registration successful", user: newUser });
  } catch (err) {
    console.log("Error creating user:", err);
    res.status(500).json({ error: "Could not create user" });
  }
});

// Login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username and password (direct comparison - NOT SECURE)
    const user = await User.findOne({ username, password });

    if (!user) {
      return res.status(404).json({ error: "User not found or incorrect password" });
    }

    // Record login time
    const loginTime = new Date();
    user.loginHistory.push({ loginTime });
    await user.save();

    res.json({ 
      message: "Login successful", 
      user: {
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        userType: user.userType
      }, 
      isAdmin: user.userType === 'admin' 
    });
  } catch (err) {
    console.log("Error finding user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout route
app.post("/logout", async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Record logout time
    const lastLogin = user.loginHistory[user.loginHistory.length - 1];
    lastLogin.logoutTime = new Date();
    await user.save();

    res.json({ message: "Logout successful" });
  } catch (err) {
    console.log("Error logging out user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get all regular users with login history (for admin dashboard)
app.get("/users", async (req, res) => {
  try {
    const users = await User.find(
      { userType: 'user' },
      {
        fullName: 1,
        email: 1,
        phoneNumber: 1,
        username: 1,
        registeredOn: 1,
        loginHistory: 1,
      }
    );
    res.json(users);
  } catch (err) {
    console.log("Error fetching users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user
app.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(user);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Delete user
app.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: 'User deleted' });
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Route to get user registration data
app.get("/api/user-registrations", async (req, res) => {
  try {
    const registrations = await User.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$registeredOn" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const labels = registrations.map(item => item._id);
    const values = registrations.map(item => item.count);

    res.json({ labels, values });
  } catch (err) {
    console.log("Error fetching user registrations:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// User Statistics
app.get("/api/user-statistics", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ userType: 'admin' });
    const regularUsers = await User.countDocuments({ userType: 'user' });
    res.json({ totalUsers, adminUsers, regularUsers });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// User Login Count (excluding admins)
app.get("/api/user-login-count", async (req, res) => {
  try {
    const users = await User.aggregate([
      { $match: { userType: 'user' } },  // Only include users, not admins
      {
        $project: {
          username: 1,
          loginCount: { $size: "$loginHistory" }
        }
      },
      { $sort: { loginCount: -1 } },
      { $limit: 10 }
    ]);

    const usernames = users.map(user => user.username);
    const loginCounts = users.map(user => user.loginCount);

    res.json({ usernames, loginCounts });
  } catch (err) {
    console.error('Error fetching user login count:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// MongoDB schema for books
const bookSchema = new mongoose.Schema({
  bookName: { type: String, required: true },
  imgUrl: { type: String, required: true },
  description: { type: String, required: true },
  publisherDate: { type: Date, required: true },
  totalCopies: { type: Number, required: true },
  purchasedCopies: { type: Number, default: 0 },
  price: { type: Number, required: true }
});

// MongoDB schema for authors
const authorSchema = new mongoose.Schema({
  authorName: { type: String, required: true },
  books: [bookSchema]
});

// MongoDB schema for publishers
const publisherSchema = new mongoose.Schema({
  publisherName: { type: String, required: true },
  authors: [authorSchema]
});

const Publisher = mongoose.model('Publisher', publisherSchema);

// Endpoint to get all books
app.get('/books', async (req, res) => {
  try {
    const publishers = await Publisher.find();
    res.status(200).json(publishers);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ message: 'Error fetching books', error });
  }
});

// Endpoint to add a new book
app.post('/books', async (req, res) => {
  try {
    console.log('Received request data:', req.body);
    const { publisherName, authorName, bookDetails } = req.body;

    if (!publisherName || !authorName || !bookDetails) {
      return res.status(400).json({ error: 'Publisher name, author name, and book details are required' });
    }

    let publisher = await Publisher.findOne({ publisherName });

    if (!publisher) {
      publisher = new Publisher({ publisherName, authors: [{ authorName, books: [bookDetails] }] });
    } else {
      let author = publisher.authors.find(author => author.authorName === authorName);
      if (!author) {
        publisher.authors.push({ authorName: authorName, books: [bookDetails] });
      } else {
        author.books.push(bookDetails);
      }
    }

    await publisher.save();
    res.json({ message: 'Book added successfully!' });
  } catch (error) {
    console.error('Error adding book:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint to handle book purchase
app.post('/purchase/:id', async (req, res) => {
  try {
    const bookId = req.params.id;
    const { quantity } = req.body;

    const publisher = await Publisher.findOne({ 'authors.books._id': bookId });

    if (!publisher) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const author = publisher.authors.find(author => author.books.id(bookId));
    const book = author.books.id(bookId);

    if (book.totalCopies < quantity) {
      return res.status(400).json({ message: 'Not enough copies available' });
    }

    book.totalCopies -= quantity;
    book.purchasedCopies += quantity;

    await publisher.save();

    res.status(200).json({ message: 'Book purchased successfully', book });
  } catch (error) {
    res.status(500).json({ message: 'Error purchasing book', error });
  }
});

// Endpoint to update book details
app.put('/books/:id', async (req, res) => {
  try {
    const bookId = req.params.id;
    const { bookName, publisherName, authorName, publisherDate, totalCopies, price, purchasedCopies } = req.body;

    const publisher = await Publisher.findOneAndUpdate(
      { 'authors.books._id': bookId },
      {
        $set: {
          'authors.$[author].books.$[book].bookName': bookName,
          'authors.$[author].books.$[book].publisherDate': publisherDate,
          'authors.$[author].books.$[book].totalCopies': totalCopies,
          'authors.$[author].books.$[book].price': price,
          'authors.$[author].books.$[book].purchasedCopies': purchasedCopies,
          'authors.$[author].authorName': authorName,
          'publisherName': publisherName,
        },
      },
      {
        arrayFilters: [{ 'author.books._id': bookId }, { 'book._id': bookId }],
        new: true,
      }
    );

    if (!publisher) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.status(200).json({
      message: 'Book details updated successfully',
      book: publisher.authors.find((author) => author.books.id(bookId)).books.id(bookId),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating book details', error });
  }
});

// Endpoint to delete a book
app.delete('/books/:id', async (req, res) => {
  try {
    const bookId = req.params.id;
    const publisher = await Publisher.findOneAndUpdate(
      { 'authors.books._id': bookId },
      { $pull: { 'authors.$.books': { _id: bookId } } },
      { new: true }
    );

    if (!publisher) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.status(200).json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Book Statistics
app.get("/api/book-statistics", async (req, res) => {
  try {
    const books = await Publisher.aggregate([
      { $unwind: '$authors' },
      { $unwind: '$authors.books' },
      {
        $group: {
          _id: null,
          totalBooks: { $sum: 1 },
          availableBooks: { $sum: '$authors.books.totalCopies' },
          purchasedBooks: { $sum: '$authors.books.purchasedCopies' }
        }
      }
    ]);
    res.json(books[0] || { totalBooks: 0, availableBooks: 0, purchasedBooks: 0 });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Publisher and Author Statistics
app.get("/api/publisher-author-statistics", async (req, res) => {
  try {
    const stats = await Publisher.aggregate([
      {
        $group: {
          _id: null,
          totalPublishers: { $sum: 1 },
          totalAuthors: { $sum: { $size: '$authors' } }
        }
      }
    ]);
    res.json(stats[0] || { totalPublishers: 0, totalAuthors: 0 });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Publisher Purchases
app.get("/api/publisher-purchases", async (req, res) => {
  try {
    const publisherPurchases = await Publisher.aggregate([
      { $unwind: '$authors' },
      { $unwind: '$authors.books' },
      {
        $group: {
          _id: '$publisherName',
          purchasedCopies: { $sum: '$authors.books.purchasedCopies' }
        }
      },
      { $sort: { purchasedCopies: -1 } },
      { $limit: 10 }
    ]);

    const publishers = publisherPurchases.map(item => item._id);
    const purchasedCopies = publisherPurchases.map(item => item.purchasedCopies);

    res.json({ publishers, purchasedCopies });
  } catch (err) {
    console.error('Error fetching publisher purchases:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a schema for the inquiry
const inquirySchema = new mongoose.Schema({
  name: String,
  email: String,
  address: String,
  phoneNo: String,
  message: String
});

const Inquiry = mongoose.model('Inquiry', inquirySchema);

// API routes
app.post('/api/inquiries', async (req, res) => {
  try {
    const inquiry = new Inquiry(req.body);
    await inquiry.save();
    res.status(201).json(inquiry);
  } catch (error) {
    res.status(400).json({ error: 'Error submitting inquiry' });
  }
});

app.get('/api/inquiries', async (req, res) => {
  try {
    const inquiries = await Inquiry.find();
    res.json(inquiries);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching inquiries' });
  }
});


const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  submittedOn: { type: Date, default: Date.now }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

app.post('/feedback', async (req, res) => {
    const { name, email, message } = req.body;
  
    try {
      const newFeedback = new Feedback({ name, email, message });
      await newFeedback.save();
      res.status(201).json({ message: 'Feedback submitted successfully' });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/feedback', async (req, res) => {
    try {
      const feedbacks = await Feedback.find();
      res.status(200).json(feedbacks);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
// Start the server
app.listen(8000, () => {
  console.log('Server started on port 8000');
});
