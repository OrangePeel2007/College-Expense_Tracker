CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -pthread

TARGET = expense_tracker

SRCS = main.cpp \
       ExpenseTracker.cpp \
       Transaction.cpp

OBJS = $(SRCS:.cpp=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(OBJS)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) $(TARGET)
