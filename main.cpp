#include <iostream>
#include <string>
#include "ExpenseTracker.h"
#include "httplib.h"
#include "json.hpp"

using json = nlohmann::json;

int main() {
    ExpenseTracker tracker;
    httplib::Server svr;

    // Serve static files from the "public" directory
    if (!svr.set_mount_point("/", "./public")) {
        std::cerr << "Failed to mount the /public directory. Please make sure it exists." << std::endl;
        return 1;
    }

    // --- API Endpoints ---

    // Get all transactions
    svr.Get("/api/transactions", [&tracker](const httplib::Request&, httplib::Response& res) {
        res.set_content(tracker.getAllTransactions().dump(), "application/json");
    });

    // Add a new transaction
    svr.Post("/api/transactions", [&tracker](const httplib::Request& req, httplib::Response& res) {
        try {
            auto j = json::parse(req.body);
            std::string type = j.at("type").get<std::string>();
            std::string category = j.at("category").get<std::string>();
            double amount = j.at("amount").get<double>();
            std::string date = j.value("date", "");
            std::string description = j.value("description", "");

            tracker.addTransaction(type, category, amount, date, description);
            
            json response = {{"status", "success"}};
            res.set_content(response.dump(), "application/json");
        } catch (const std::exception& e) {
            json error = {{"status", "error"}, {"message", e.what()}};
            res.status = 400;
            res.set_content(error.dump(), "application/json");
        }
    });

    // Delete a transaction
    svr.Delete(R"(/api/transactions/(\d+))", [&tracker](const httplib::Request& req, httplib::Response& res) {
        int id = std::stoi(req.matches[1]);
        if (tracker.deleteTransaction(id)) {
            json response = {{"status", "success"}};
            res.set_content(response.dump(), "application/json");
        } else {
            json error = {{"status", "error"}, {"message", "Transaction not found"}};
            res.status = 404;
            res.set_content(error.dump(), "application/json");
        }
    });

    // Get Summary
    svr.Get("/api/summary", [&tracker](const httplib::Request&, httplib::Response& res) {
        res.set_content(tracker.getSummary().dump(), "application/json");
    });

    // Get Budgets
    svr.Get("/api/budgets", [&tracker](const httplib::Request&, httplib::Response& res) {
        res.set_content(tracker.getBudgets().dump(), "application/json");
    });

    // Set Budget
    svr.Post("/api/budgets", [&tracker](const httplib::Request& req, httplib::Response& res) {
        try {
            auto j = json::parse(req.body);
            std::string category = j.at("category").get<std::string>();
            double amount = j.at("amount").get<double>();

            tracker.setBudget(category, amount);
            
            json response = {{"status", "success"}};
            res.set_content(response.dump(), "application/json");
        } catch (const std::exception& e) {
            json error = {{"status", "error"}, {"message", e.what()}};
            res.status = 400;
            res.set_content(error.dump(), "application/json");
        }
    });

    // Get Suggested Categories
    svr.Get("/api/categories", [](const httplib::Request&, httplib::Response& res) {
        json j = ExpenseTracker::getSuggestedCategories();
        res.set_content(j.dump(), "application/json");
    });

    std::cout << "Starting Server on http://localhost:8080..." << std::endl;
    std::cout << "Make sure to place index.html in the 'public' folder." << std::endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}
