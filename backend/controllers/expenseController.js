const Expense = require('../models/Expense');
const User = require('../models/User');

// @desc    Get all expenses with filtering, sorting and search
// @route   GET /api/expenses
// @access  Private
const getExpenses = async (req, res) => {
    try {
        const { search, category, startDate, endDate, sort } = req.query;

        const query = { user: req.user._id };

        if (category) {
            query.category = category;
        }

        if (req.query.transactionType) {
            query.transactionType = req.query.transactionType;
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        if (search) {
            query.description = { $regex: search, $options: 'i' };
        }

        let sortOption = { date: -1, _id: -1 };
        if (sort === 'amount_asc') sortOption = { amount: 1, _id: -1 };
        if (sort === 'amount_desc') sortOption = { amount: -1, _id: -1 };
        if (sort === 'date_asc') sortOption = { date: 1, _id: 1 };
        if (sort === 'date_desc') sortOption = { date: -1, _id: -1 };

        const expenses = await Expense.find(query).sort(sortOption);

        res.status(200).json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
const getExpenseById = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        if (expense.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to view this expense' });
        }

        res.status(200).json(expense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
const createExpense = async (req, res) => {
    const { amount, category, date, description, transactionType } = req.body;

    if (!amount || !category) {
        return res.status(400).json({ message: 'Amount and category are required' });
    }

    try {
        const expense = new Expense({
            user: req.user._id,
            amount,
            category,
            transactionType: transactionType || 'debit',
            date: date || Date.now(),
            description
        });

        const createdExpense = await expense.save();

        // Update User Vault Balance
        const user = await User.findById(req.user._id);
        if (user) {
            if (createdExpense.transactionType === 'credit') {
                user.vaultBalance += Number(amount);
            } else {
                user.vaultBalance -= Number(amount);
            }
            await user.save();
        }

        res.status(201).json(createdExpense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = async (req, res) => {
    try {
        let expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        if (expense.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to update this expense' });
        }

        const oldAmount = expense.amount;
        const oldType = expense.transactionType;

        const updatedExpense = await Expense.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        // Adjust User Vault Balance
        const user = await User.findById(req.user._id);
        if (user) {
            // Reverse old transaction
            if (oldType === 'credit') {
                user.vaultBalance -= oldAmount;
            } else {
                user.vaultBalance += oldAmount;
            }

            // Apply new transaction
            if (updatedExpense.transactionType === 'credit') {
                user.vaultBalance += updatedExpense.amount;
            } else {
                user.vaultBalance -= updatedExpense.amount;
            }
            await user.save();
        }

        res.status(200).json(updatedExpense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
const deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        if (expense.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to delete this expense' });
        }

        // Reverse Vault balance before deleting
        const user = await User.findById(req.user._id);
        if (user) {
            if (expense.transactionType === 'credit') {
                user.vaultBalance -= expense.amount;
            } else {
                user.vaultBalance += expense.amount;
            }
            await user.save();
        }

        await expense.deleteOne();
        res.status(200).json({ message: 'Expense removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getExpenses,
    getExpenseById,
    createExpense,
    updateExpense,
    deleteExpense
};
