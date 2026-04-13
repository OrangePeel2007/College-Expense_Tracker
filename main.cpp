#include "ExpenseTracker.h"
#include "json.hpp"
#include "plugins/httplib.h"
#include <fstream>
#include <iostream>
#include <map>
#include <memory>
#include <string>

using json = nlohmann::json;

// Simple non-cryptographic hash acting as a basic scrambler for local storage
std::string simpleHash(const std::string &input) {
  unsigned long hash = 5381;
  for (char c : input) {
    hash = ((hash << 5) + hash) + c; /* hash * 33 + c */
  }
  return std::to_string(hash);
}

struct UserData {
  std::string password;
  std::string role;
};

std::map<std::string, UserData> users;
std::map<std::string, std::unique_ptr<ExpenseTracker>> trackers;

// Forward declaration ensures loadUsers can save if needed
void saveUsers();

void loadUsers() {
  std::ifstream file("users.json");
  if (file.is_open()) {
    try {
      json j;
      file >> j;
      for (auto &el : j.items()) {
        if (el.value().is_object() && el.value().contains("password")) {
          users[el.key()] = {el.value()["password"],
                             el.value().value("role", "user")};
        } else if (el.value().is_string()) {
          users[el.key()] = {el.value(), "user"};
        }
      }
    } catch (...) {
    }
  }

  if (users.find("admin") == users.end()) {
    users["admin"] = {simpleHash("admin"), "admin"};
    saveUsers();
  }
}

void saveUsers() {
  std::ofstream file("users.json");
  if (file.is_open()) {
    json j;
    for (const auto &pair : users) {
      j[pair.first] = {{"password", pair.second.password},
                       {"role", pair.second.role}};
    }
    file << j.dump(4);
  }
}

ExpenseTracker *getTracker(const std::string &userId) {
  if (userId.empty())
    return nullptr;
  if (trackers.find(userId) == trackers.end()) {
    trackers[userId] = std::make_unique<ExpenseTracker>(
        userId + "_transactions.csv", userId + "_budgets.csv");
  }
  return trackers[userId].get();
}

int main() {
  loadUsers();
  httplib::Server svr;

  if (!svr.set_mount_point("/", "./public")) {
    std::cerr
        << "Failed to mount the /public directory. Please make sure it exists."
        << std::endl;
    return 1;
  }

  // --- User & Auth Endpoints ---
  svr.Get("/api/users", [](const httplib::Request &, httplib::Response &res) {
    json j = json::array();
    for (const auto &pair : users) {
      j.push_back({{"username", pair.first}, {"role", pair.second.role}});
    }
    res.set_content(j.dump(), "application/json");
  });

  svr.Post("/api/users/add", [](const httplib::Request &req,
                                httplib::Response &res) {
    std::string reqUser = req.get_header_value("x-user-id");
    if (reqUser.empty() || users.find(reqUser) == users.end() ||
        users[reqUser].role != "admin") {
      res.status = 401;
      res.set_content(
          R"({"status":"error","message":"Unauthorized: Admin only"})",
          "application/json");
      return;
    }

    try {
      auto j = json::parse(req.body);
      std::string username = j.at("username").get<std::string>();
      std::string password = j.at("password").get<std::string>();
      std::string role = j.value("role", "user");

      if (users.find(username) != users.end()) {
        res.status = 400;
        res.set_content(R"({"status":"error","message":"User already exists"})",
                        "application/json");
        return;
      }

      users[username] = {simpleHash(password), role};
      saveUsers();

      res.set_content(R"({"status":"success"})", "application/json");
    } catch (const std::exception &e) {
      json error = {{"status", "error"}, {"message", e.what()}};
      res.status = 400;
      res.set_content(error.dump(), "application/json");
    }
  });

  svr.Delete(R"(/api/users/([^/]+))", [](const httplib::Request &req,
                                         httplib::Response &res) {
    std::string reqUser = req.get_header_value("x-user-id");
    if (reqUser.empty() || users.find(reqUser) == users.end() ||
        users[reqUser].role != "admin") {
      res.status = 401;
      res.set_content(
          R"({"status":"error","message":"Unauthorized: Admin only"})",
          "application/json");
      return;
    }
    std::string targetUser = req.matches[1];
    if (users.find(targetUser) != users.end()) {
      if (targetUser == "admin") {
        res.status = 400;
        res.set_content(
            R"({"status":"error","message":"Cannot delete main admin"})",
            "application/json");
        return;
      }
      users.erase(targetUser);
      saveUsers();

      std::remove((targetUser + "_transactions.csv").c_str());
      std::remove((targetUser + "_budgets.csv").c_str());
      trackers.erase(targetUser);

      res.set_content(R"({"status":"success"})", "application/json");
    } else {
      res.status = 404;
      res.set_content(R"({"status":"error","message":"User not found"})",
                      "application/json");
    }
  });

  svr.Put(R"(/api/users/([^/]+)/rename)", [](const httplib::Request &req,
                                             httplib::Response &res) {
    std::string reqUser = req.get_header_value("x-user-id");
    if (reqUser.empty() || users.find(reqUser) == users.end() ||
        users[reqUser].role != "admin") {
      res.status = 401;
      res.set_content(
          R"({"status":"error","message":"Unauthorized: Admin only"})",
          "application/json");
      return;
    }
    std::string targetUser = req.matches[1];
    try {
      auto j = json::parse(req.body);
      std::string newUsername = j.at("newUsername").get<std::string>();

      if (users.find(targetUser) == users.end()) {
        res.status = 404;
        res.set_content(R"({"status":"error","message":"User not found"})",
                        "application/json");
        return;
      }
      if (users.find(newUsername) != users.end()) {
        res.status = 400;
        res.set_content(
            R"({"status":"error","message":"New username already exists"})",
            "application/json");
        return;
      }
      if (targetUser == "admin") {
        res.status = 400;
        res.set_content(
            R"({"status":"error","message":"Cannot rename main admin"})",
            "application/json");
        return;
      }

      users[newUsername] = users[targetUser];
      users.erase(targetUser);
      saveUsers();

      std::rename((targetUser + "_transactions.csv").c_str(),
                  (newUsername + "_transactions.csv").c_str());
      std::rename((targetUser + "_budgets.csv").c_str(),
                  (newUsername + "_budgets.csv").c_str());

      trackers.erase(targetUser);
      trackers.erase(newUsername);

      res.set_content(R"({"status":"success"})", "application/json");
    } catch (const std::exception &e) {
      json error = {{"status", "error"}, {"message", e.what()}};
      res.status = 400;
      res.set_content(error.dump(), "application/json");
    }
  });

  svr.Post("/api/login", [](const httplib::Request &req,
                            httplib::Response &res) {
    try {
      auto j = json::parse(req.body);
      std::string username = j.at("username").get<std::string>();
      std::string password = j.at("password").get<std::string>();

      if (users.find(username) != users.end() &&
          users[username].password == simpleHash(password)) {
        json response = {{"status", "success"}, {"role", users[username].role}};
        res.set_content(response.dump(), "application/json");
      } else {
        res.status = 401;
        res.set_content(R"({"status":"error","message":"Invalid credentials"})",
                        "application/json");
      }
    } catch (const std::exception &e) {
      json error = {{"status", "error"}, {"message", e.what()}};
      res.status = 400;
      res.set_content(error.dump(), "application/json");
    }
  });

  // Helper macro/function to validate tracker inside endpoints
  auto withTracker = [](const httplib::Request &req, httplib::Response &res,
                        std::function<void(ExpenseTracker *)> func) {
    std::string userId = req.get_header_value("x-user-id");
    if (userId.empty() || users.find(userId) == users.end()) {
      res.status = 401;
      res.set_content(R"({"status":"error","message":"Unauthorized"})",
                      "application/json");
      return;
    }
    func(getTracker(userId));
  };

  // --- Expense Tracker Endpoints ---
  svr.Get("/api/transactions", [&withTracker](const httplib::Request &req,
                                              httplib::Response &res) {
    withTracker(req, res, [&res](ExpenseTracker *t) {
      res.set_content(t->getAllTransactions().dump(), "application/json");
    });
  });

  svr.Post("/api/transactions",
           [&withTracker](const httplib::Request &req, httplib::Response &res) {
             withTracker(req, res, [&req, &res](ExpenseTracker *t) {
               try {
                 auto j = json::parse(req.body);
                 std::string type = j.at("type").get<std::string>();
                 std::string category = j.at("category").get<std::string>();
                 double amount = j.at("amount").get<double>();
                 std::string date = j.value("date", "");
                 std::string description = j.value("description", "");

                 t->addTransaction(type, category, amount, date, description);
                 json response = {{"status", "success"}};
                 res.set_content(response.dump(), "application/json");
               } catch (const std::exception &e) {
                 json error = {{"status", "error"}, {"message", e.what()}};
                 res.status = 400;
                 res.set_content(error.dump(), "application/json");
               }
             });
           });

  svr.Delete(
      R"(/api/transactions/(\d+))",
      [&withTracker](const httplib::Request &req, httplib::Response &res) {
        withTracker(req, res, [&req, &res](ExpenseTracker *t) {
          int id = std::stoi(req.matches[1]);
          if (t->deleteTransaction(id)) {
            json response = {{"status", "success"}};
            res.set_content(response.dump(), "application/json");
          } else {
            json error = {{"status", "error"},
                          {"message", "Transaction not found"}};
            res.status = 404;
            res.set_content(error.dump(), "application/json");
          }
        });
      });

  svr.Get("/api/summary",
          [&withTracker](const httplib::Request &req, httplib::Response &res) {
            withTracker(req, res, [&res](ExpenseTracker *t) {
              res.set_content(t->getSummary().dump(), "application/json");
            });
          });

  svr.Get("/api/budgets",
          [&withTracker](const httplib::Request &req, httplib::Response &res) {
            withTracker(req, res, [&res](ExpenseTracker *t) {
              res.set_content(t->getBudgets().dump(), "application/json");
            });
          });

  svr.Post("/api/budgets",
           [&withTracker](const httplib::Request &req, httplib::Response &res) {
             withTracker(req, res, [&req, &res](ExpenseTracker *t) {
               try {
                 auto j = json::parse(req.body);
                 std::string category = j.at("category").get<std::string>();
                 double amount = j.at("amount").get<double>();

                 t->setBudget(category, amount);
                 json response = {{"status", "success"}};
                 res.set_content(response.dump(), "application/json");
               } catch (const std::exception &e) {
                 json error = {{"status", "error"}, {"message", e.what()}};
                 res.status = 400;
                 res.set_content(error.dump(), "application/json");
               }
             });
           });

  svr.Get("/api/categories",
          [](const httplib::Request &req, httplib::Response &res) {
            std::string userId = req.get_header_value("x-user-id");
            if (userId.empty() || users.find(userId) == users.end()) {
              res.status = 401;
              res.set_content(R"({"status":"error","message":"Unauthorized"})",
                              "application/json");
              return;
            }
            json j = ExpenseTracker::getSuggestedCategories();
            res.set_content(j.dump(), "application/json");
          });

  std::cout << "Starting Multi-User Server on http://localhost:8080..."
            << std::endl;
  std::cout << "Make sure to place index.html in the 'public' folder."
            << std::endl;
  svr.listen("0.0.0.0", 8080);

  return 0;
}
