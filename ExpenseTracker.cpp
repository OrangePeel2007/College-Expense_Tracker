#include "ExpenseTracker.h"
#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <ctime>

ExpenseTracker::ExpenseTracker(const std::string& dataFileName, const std::string& budgetFileName)
    : nextId(1), dataFile(dataFileName), budgetFile(budgetFileName) {
    loadData();
    loadBudgets();
}

ExpenseTracker::~ExpenseTracker() {
    saveData();
    saveBudgets();
}

void ExpenseTracker::loadData() {
    std::ifstream file(dataFile);
    if (!file.is_open()) return;

    std::string line;
    while (std::getline(file, line)) {
        if (line.empty()) continue;
        Transaction t = Transaction::fromCSV(line);
        transactions.push_back(t);
        if (t.id >= nextId) {
            nextId = t.id + 1;
        }
    }
}

void ExpenseTracker::saveData() const {
    std::ofstream file(dataFile);
    if (!file.is_open()) return;

    for (const auto& t : transactions) {
        file << t.toCSV() << "\n";
    }
}

void ExpenseTracker::loadBudgets() {
    std::ifstream file(budgetFile);
    if (!file.is_open()) return;

    std::string line;
    while (std::getline(file, line)) {
        if (line.empty()) continue;
        std::stringstream ss(line);
        std::string category, amtStr;
        std::getline(ss, category, ',');
        std::getline(ss, amtStr);
        budgets[category] = std::stod(amtStr);
    }
}

void ExpenseTracker::saveBudgets() const {
    std::ofstream file(budgetFile);
    if (!file.is_open()) return;
    
    for (const auto& pair : budgets) {
        file << pair.first << "," << pair.second << "\n";
    }
}

std::string ExpenseTracker::getCurrentDate() const {
    std::time_t t = std::time(nullptr);
    std::tm* now = std::localtime(&t);
    char buf[11];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d", now);
    return std::string(buf);
}

void ExpenseTracker::addTransaction(const std::string& type, const std::string& category, double amount, const std::string& date, const std::string& description) {
    std::string finalDate = date.empty() ? getCurrentDate() : date;
    transactions.push_back({nextId++, type, category, amount, finalDate, description});
    std::cout << "Transaction added successfully.\n";
    saveData();
}

bool ExpenseTracker::deleteTransaction(int id) {
    auto it = std::remove_if(transactions.begin(), transactions.end(), [id](const Transaction& t) { return t.id == id; });
    if (it != transactions.end()) {
        transactions.erase(it, transactions.end());
        saveData();
        return true;
    }
    return false;
}

nlohmann::json ExpenseTracker::getAllTransactions() const {
    nlohmann::json j = nlohmann::json::array();
    for (const auto& t : transactions) {
        j.push_back(t.toJson());
    }
    return j;
}

void ExpenseTracker::setBudget(const std::string& category, double amount) {
    budgets[category] = amount;
    saveBudgets();
}

nlohmann::json ExpenseTracker::getBudgets() const {
    nlohmann::json j = nlohmann::json::object();
    for (const auto& b : budgets) {
        j[b.first] = b.second;
    }
    return j;
}

nlohmann::json ExpenseTracker::getSummary() const {
    double totalIncome = 0.0;
    double totalExpense = 0.0;
    std::map<std::string, double> categorySpent;

    for (const auto& t : transactions) {
        if (t.type == "INCOME") {
            totalIncome += t.amount;
        } else if (t.type == "EXPENSE") {
            totalExpense += t.amount;
            categorySpent[t.category] += t.amount;
        }
    }

    nlohmann::json summary;
    summary["totalIncome"] = totalIncome;
    summary["totalExpense"] = totalExpense;
    summary["netSavings"] = totalIncome - totalExpense;
    summary["warning"] = (totalExpense > totalIncome && totalIncome > 0) ? "You have spent more than you earned!" : "";

    nlohmann::json breakdown = nlohmann::json::array();
    
    std::vector<std::string> allCategories;
    for (const auto& pair : budgets) allCategories.push_back(pair.first);
    for (const auto& pair : categorySpent) {
        if (std::find(allCategories.begin(), allCategories.end(), pair.first) == allCategories.end()) {
            allCategories.push_back(pair.first);
        }
    }

    for (const auto& cat : allCategories) {
        double budget = budgets.count(cat) ? budgets.at(cat) : 0.0;
        double spent = categorySpent[cat];
        double diff = budget - spent;
        
        std::string status = "ON_TRACK";
        if (budget > 0 && spent > budget) {
            status = "OVER_BUDGET";
        } else if (budget > 0 && spent / budget >= 0.8) {
            status = "ALMOST_EMPTY";
        }

        breakdown.push_back({
            {"category", cat},
            {"budget", budget},
            {"spent", spent},
            {"remaining", diff},
            {"status", status}
        });
    }

    summary["breakdown"] = breakdown;
    return summary;
}

std::vector<std::string> ExpenseTracker::getSuggestedCategories() {
    return {
        "Tuition", "Textbooks", "Rent/Housing", "Food/Dining", 
        "Groceries", "Transportation", "Entertainment", "Utilities", 
        "Health/Fitness", "Savings", "Other"
    };
}
