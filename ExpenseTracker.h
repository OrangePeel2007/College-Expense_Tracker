#pragma once

#include <vector>
#include <string>
#include <map>
#include "json.hpp"
#include "Transaction.h"

class ExpenseTracker {
private:
    std::vector<Transaction> transactions;
    std::map<std::string, double> budgets;
    int nextId;
    std::string dataFile;
    std::string budgetFile;

    void loadData();
    void saveData() const;
    void saveBudgets() const;
    void loadBudgets();

    std::string getCurrentDate() const;

public:
    ExpenseTracker(const std::string& dataFileName = "transactions.csv", 
                   const std::string& budgetFileName = "budgets.csv");
    ~ExpenseTracker();

    // Transactions API
    void addTransaction(const std::string& type, const std::string& category, double amount, const std::string& date, const std::string& description);
    bool deleteTransaction(int id);
    nlohmann::json getAllTransactions() const;

    // Budget API
    void setBudget(const std::string& category, double amount);
    nlohmann::json getBudgets() const;
    
    // Smart features
    nlohmann::json getSummary() const;
    static std::vector<std::string> getSuggestedCategories();
};
