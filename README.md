# Smart College Expense Tracker

A blazing fast, locally hosted C++ command-line application that acts as a web server, rendering a beautiful Glassmorphism user interface through your web browser. Built tailored for college student tracking budgets, expenses, and incomes.

## How to Start the App

1. Open a terminal and navigate to this folder:
   ```sh
   cd "/Users/badrinathnandan/Documents/Expense Tracker"
   ```

2. Start the tracking server:
   ```sh
   ./expense_tracker
   ```
   *(If you've altered any C++ code, run `make` first to compile the changes!)*

3. Open your web browser and navigate to:
   **[http://localhost:8080](http://localhost:8080)**

## How to Stop the App

To safely shut down the web server, simply go back to the terminal where the app is running and press:
**`Ctrl + C`**

This will gracefully terminate the C++ process and stop the website from loading until you start it again. All your transactions and budgets will remain securely saved in your `transactions.csv` and `budgets.csv` files.
