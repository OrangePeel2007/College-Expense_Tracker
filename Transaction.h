#pragma once
#include <string>
#include "json.hpp"

struct Transaction {
    int id;
    std::string type; // "INCOME" or "EXPENSE"
    std::string category;
    double amount;
    std::string date; // YYYY-MM-DD format
    std::string description;

    // Convert transaction to a comma-separated string for saving
    std::string toCSV() const;
    
    // Parse from CSV string
    static Transaction fromCSV(const std::string& csvLine);

    // Convert to JSON
    nlohmann::json toJson() const;
};
