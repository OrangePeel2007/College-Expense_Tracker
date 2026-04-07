#include "Transaction.h"
#include <sstream>

std::string Transaction::toCSV() const {
    std::stringstream ss;
    ss << id << "," << type << "," << category << "," << amount << "," << date << "," << description;
    return ss.str();
}

Transaction Transaction::fromCSV(const std::string& csvLine) {
    Transaction t;
    std::stringstream ss(csvLine);
    std::string token;

    std::getline(ss, token, ',');
    t.id = std::stoi(token);

    std::getline(ss, t.type, ',');
    std::getline(ss, t.category, ',');

    std::getline(ss, token, ',');
    t.amount = std::stod(token);

    std::getline(ss, t.date, ',');
    std::getline(ss, t.description); // Rest of the line is description

    return t;
}

nlohmann::json Transaction::toJson() const {
    return nlohmann::json{
        {"id", id},
        {"type", type},
        {"category", category},
        {"amount", amount},
        {"date", date},
        {"description", description}
    };
}
