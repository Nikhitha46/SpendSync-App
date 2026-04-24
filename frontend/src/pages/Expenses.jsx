import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Trash2, Edit2, X, Receipt, ArrowDownRight, ArrowUpRight, AlertTriangle, ShieldAlert } from 'lucide-react';
import api from '../utils/api';

const Expenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ amount: '', category: 'Food', date: '', description: '', transactionType: 'debit' });
    const [editingId, setEditingId] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sort, setSort] = useState('date_desc');

    // Budget / vault state
    const [vaultBalance, setVaultBalance] = useState(null);         // all-time net balance
    const [monthlyBudget, setMonthlyBudget] = useState(0);          // budget for selected month
    const [monthlySpent, setMonthlySpent] = useState(0);            // debits already spent this month
    const [monthlyIncome, setMonthlyIncome] = useState(0);          // credits received this month
    const [showBudgetWarning, setShowBudgetWarning] = useState(false); // budget-exceeded popup

    const debitCategories = ['Food', 'Travel', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Other'];
    const creditCategories = ['Salary', 'Funds', 'Cashback', 'Refund', 'Other Income'];

    // ── Derived checks ────────────────────────────────────────────────────────
    const isDebit = formData.transactionType === 'debit';
    const enteredAmount = parseFloat(formData.amount) || 0;

    // Vault: you can't spend more than what exists overall
    const exceedsVault = isDebit && vaultBalance !== null && enteredAmount > vaultBalance;

    // Monthly savings remaining = budget + income received - debits spent
    const remainingSavings = monthlyBudget + monthlyIncome - monthlySpent;

    // Monthly budget: new expense would exceed what's left in monthly savings
    const exceedsBudget = isDebit && monthlyBudget > 0 && enteredAmount > remainingSavings;

    // ── Fetch expenses list ───────────────────────────────────────────────────
    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/expenses', {
                params: { search, category: categoryFilter, sort }
            });
            setExpenses(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchExpenses();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [search, categoryFilter, sort]);

    // ── Fetch vault balance (all-time) ────────────────────────────────────────
    useEffect(() => {
        const fetchVault = async () => {
            try {
                const [analyticsRes, budgetsRes] = await Promise.all([
                    api.get('/analytics'),
                    api.get('/budget/all').catch(() => ({ data: [] }))
                ]);
                const totalIncome = analyticsRes.data.totalIncome || 0;
                const totalExpenses = analyticsRes.data.totalExpenses || 0;
                const totalBudgets = (budgetsRes.data || []).reduce((acc, b) => acc + b.amount, 0);
                setVaultBalance(totalBudgets + totalIncome - totalExpenses);
            } catch (err) {
                console.error('Failed to fetch vault balance', err);
            }
        };
        fetchVault();
    }, [expenses]); // re-check after any transaction change

    // ── Fetch monthly budget + current spending when modal opens ─────────────
    useEffect(() => {
        if (!isModalOpen || !formData.date) return;

        const month = formData.date.slice(0, 7); // YYYY-MM
        const fetchMonthlyData = async () => {
            try {
                const [budgetRes, analyticsRes] = await Promise.all([
                    api.get(`/budget?month=${month}`).catch(() => ({ data: null })),
                    api.get(`/analytics?month=${month}`)
                ]);
                setMonthlyBudget(budgetRes.data?.amount || 0);
                setMonthlySpent(analyticsRes.data?.totalExpenses || 0);
                setMonthlyIncome(analyticsRes.data?.totalIncome || 0);
            } catch (err) {
                console.error('Failed to fetch monthly data', err);
            }
        };

        fetchMonthlyData();
    }, [isModalOpen, formData.date]);

    // ── Save transaction ──────────────────────────────────────────────────────
    const saveTransaction = async () => {
        try {
            if (editingId) {
                await api.put(`/expenses/${editingId}`, formData);
            } else {
                await api.post('/expenses', formData);
            }
            setIsModalOpen(false);
            setShowBudgetWarning(false);
            setEditingId(null);
            setFormData({ amount: '', category: 'Food', date: '', description: '', transactionType: 'debit' });
            fetchExpenses();
        } catch (error) {
            console.error('Failed to save expense');
        }
    };

    // ── Form submit: gate on budget check ────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Only apply guards for debit transactions (not for edits, where budget context is complex)
        if (isDebit && !editingId && exceedsBudget) {
            setShowBudgetWarning(true);
            return;
        }

        await saveTransaction();
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this transaction?")) {
            try {
                await api.delete(`/expenses/${id}`);
                fetchExpenses();
            } catch (error) {
                console.error("Failed to delete transaction");
            }
        }
    };

    const openEdit = (expense) => {
        setFormData({
            amount: expense.amount,
            category: expense.category,
            transactionType: expense.transactionType || 'debit',
            date: expense.date.split('T')[0],
            description: expense.description
        });
        setEditingId(expense._id);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setShowBudgetWarning(false);
        setEditingId(null);
    };

    const currentCategories = formData.transactionType === 'credit' ? creditCategories : debitCategories;

    return (
        <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-2 space-y-4 md:space-y-0 px-1">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">Transaction History</h1>
                    <p className="text-sm text-slate-400 mt-1">Manage your income and expenses seamlessly</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setShowBudgetWarning(false);
                        setFormData({ amount: '', category: 'Food', date: new Date().toISOString().split('T')[0], description: '', transactionType: 'debit' });
                        setIsModalOpen(true);
                    }}
                    className="hidden md:flex items-center space-x-2 bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl shadow-lg ring-2 ring-primary/30 transition-all font-semibold transform active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    <span>New Transaction</span>
                </button>
            </header>

            {/* Mobile FAB */}
            <button
                onClick={() => {
                    setEditingId(null);
                    setShowBudgetWarning(false);
                    setFormData({ amount: '', category: 'Food', date: new Date().toISOString().split('T')[0], description: '', transactionType: 'debit' });
                    setIsModalOpen(true);
                }}
                className="md:hidden fixed bottom-28 right-6 z-[60] w-14 h-14 bg-primary text-white rounded-2xl shadow-[0_8px_30px_rgb(59,130,246,0.5)] flex items-center justify-center transition-transform active:scale-90 animate-in fade-in slide-in-from-bottom-10 duration-500"
            >
                <Plus className="w-8 h-8" />
            </button>

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-3 bg-surface/40 md:bg-surface/50 border border-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl backdrop-blur-sm shadow-xl">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                        type="text"
                        placeholder="Search transactions..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-10 pr-4 py-3 text-sm md:text-base text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-2 md:flex gap-3">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-9 pr-3 py-3 text-xs md:text-sm text-white focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="" className="bg-surface text-slate-200">All</option>
                            <optgroup label="Income" className="text-slate-400">
                                {creditCategories.map(c => <option key={c} value={c} className="bg-surface text-slate-200">{c}</option>)}
                            </optgroup>
                            <optgroup label="Expenses" className="text-slate-400">
                                {debitCategories.map(c => <option key={c} value={c} className="bg-surface text-slate-200">{c}</option>)}
                            </optgroup>
                        </select>
                    </div>
                    <select 
                        className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-3 py-3 text-xs md:text-sm text-white focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                    >
                        <option value="date_desc" className="bg-surface text-white">Latest</option>
                        <option value="date_asc" className="bg-surface text-white">Oldest</option>
                        <option value="amount_desc" className="bg-surface text-white">Highest</option>
                        <option value="amount_asc" className="bg-surface text-white">Lowest</option>
                    </select>
                </div>
            </div>

            {/* Transaction List */}
            <div className="flex-1 rounded-2xl overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 bg-surface/50 rounded-3xl border border-white/5">
                        <Receipt className="w-16 h-16 opacity-20 mb-4" />
                        <p>No transactions found.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {expenses.map((expense) => {
                            const isCredit = expense.transactionType === 'credit';
                            return (
                                <div key={expense._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-5 bg-surface/60 md:bg-surface/80 border border-white/5 rounded-2xl md:rounded-[2rem] shadow-lg hover:bg-white/5 transition-all group relative overflow-hidden backdrop-blur-sm">
                                     <div className="flex items-center space-x-3 md:space-x-4 mb-3 sm:mb-0">
                                         <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex flex-shrink-0 items-center justify-center border ${isCredit ? 'bg-secondary/10 border-secondary/20 text-secondary-400' : 'bg-danger/10 border-danger/20 text-danger-400'}`}>
                                             {isCredit ? <ArrowDownRight className="w-5 h-5 md:w-6 md:h-6" /> : <ArrowUpRight className="w-5 h-5 md:w-6 md:h-6" />}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <h4 className="font-bold text-white text-base md:text-lg leading-tight truncate">{expense.category}</h4>
                                             <p className="text-xs md:text-sm text-slate-500 flex items-center mt-0.5">
                                                 <span className="whitespace-nowrap">{new Date(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
                                                 {expense.description && (
                                                     <>
                                                         <span className="mx-1.5 w-1 h-1 bg-slate-700 rounded-full"></span>
                                                         <span className="truncate max-w-[120px] md:max-w-xs">{expense.description}</span>
                                                     </>
                                                 )}
                                             </p>
                                         </div>
                                     </div>
                                     <div className="flex justify-between sm:flex-col sm:items-end items-center pl-13 sm:pl-0">
                                         <span className={`text-lg md:text-xl font-black tracking-tight ${isCredit ? 'text-secondary-400' : 'text-white'}`}>
                                             {isCredit ? '+' : '-'}₹{expense.amount.toLocaleString()}
                                         </span>
                                         <div className="flex space-x-2 mt-0 sm:mt-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={() => openEdit(expense)} className="p-2 text-slate-400 hover:text-primary transition-colors bg-white/5 hover:bg-primary/10 rounded-xl">
                                                 <Edit2 className="w-4 h-4" />
                                             </button>
                                             <button onClick={() => handleDelete(expense._id)} className="p-2 text-slate-400 hover:text-danger transition-colors bg-white/5 hover:bg-danger/10 rounded-xl">
                                                 <Trash2 className="w-4 h-4" />
                                             </button>
                                         </div>
                                     </div>
                                 </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Transaction Modal ──────────────────────────────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 transition-all">
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={closeModal}></div>

                    <div className="bg-surface border-t md:border border-white/10 w-full max-w-md rounded-t-[2.5rem] md:rounded-3xl p-6 md:p-8 relative z-10 shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="md:hidden w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6"></div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl md:text-2xl font-bold text-white">{editingId ? 'Edit Transaction' : 'New Transaction'}</h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-white p-2 bg-white/5 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            
                            {/* Type Toggle */}
                            <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 mt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setFormData({...formData, transactionType: 'debit', category: debitCategories[0]})} 
                                    className={`flex-1 py-2.5 font-semibold rounded-lg transition-all text-sm ${formData.transactionType === 'debit' ? 'bg-danger/20 text-danger-300 shadow-sm' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Expense
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setFormData({...formData, transactionType: 'credit', category: creditCategories[0]})} 
                                    className={`flex-1 py-2.5 font-semibold rounded-lg transition-all text-sm ${formData.transactionType === 'credit' ? 'bg-secondary/20 text-secondary-300 shadow-sm' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Income
                                </button>
                            </div>

                            {/* Amount field with vault warning */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Amount (₹)</label>
                                <input 
                                    type="number" 
                                    required 
                                    min="0"
                                    className={`w-full bg-white/5 border rounded-2xl px-4 py-4 text-white focus:ring-2 outline-none font-black text-2xl md:text-3xl transition-all ${
                                        exceedsVault
                                            ? 'border-red-500/60 focus:ring-red-500/40 bg-red-500/5'
                                            : 'border-white/10 focus:ring-primary'
                                    }`}
                                    value={formData.amount}
                                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                />
                                {/* Vault exceeded inline warning */}
                                {exceedsVault && (
                                    <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3">
                                        <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-300 leading-snug">
                                            Amount exceeds vault balance of{' '}
                                            <span className="font-bold text-red-200">₹{vaultBalance.toLocaleString()}</span>.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                                    <select 
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
                                        value={formData.category}
                                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                                    >
                                        {currentCategories.map(c => <option key={c} value={c} className="bg-surface">{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                                    <input 
                                        type="date" 
                                        required 
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:ring-2 focus:ring-primary outline-none [color-scheme:dark]"
                                        value={formData.date}
                                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:ring-2 focus:ring-primary outline-none"
                                    value={formData.description}
                                    placeholder="What was this for?"
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                            
                            <div className="pt-4 flex gap-3 pb-8 md:pb-0">
                                <button 
                                    type="button" 
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-4 rounded-2xl font-bold bg-white/5 hover:bg-white/10 text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={exceedsVault}
                                    className={`flex-1 px-4 py-4 rounded-2xl font-black text-white shadow-lg transition-all ${
                                        exceedsVault
                                            ? 'bg-slate-600/50 text-slate-400 cursor-not-allowed opacity-60'
                                            : formData.transactionType === 'credit'
                                                ? 'bg-secondary/90 hover:bg-secondary'
                                                : 'bg-primary hover:bg-primary/90'
                                    }`}
                                >
                                    {editingId ? 'Update' : 'Confirm'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* ── Budget Exceeded Warning Popup ──────────────────────────────── */}
                    {showBudgetWarning && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                            {/* semi-transparent overlay behind the popup (but within the modal backdrop) */}
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowBudgetWarning(false)} />

                            <div className="relative z-[120] w-full max-w-sm bg-[#1a1f2e] border border-amber-500/30 rounded-[2.5rem] p-6 md:p-8 shadow-2xl ring-1 ring-amber-400/20 animate-in fade-in zoom-in-95 duration-200">
                                {/* Icon */}
                                <div className="flex justify-center mb-6">
                                    <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                                        <AlertTriangle className="w-10 h-10 text-amber-400" />
                                    </div>
                                </div>

                                {/* Title */}
                                <h3 className="text-2xl font-black text-white text-center mb-2">Limit Reached!</h3>

                                {/* Body */}
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 mb-6">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-400">Monthly Budget</span>
                                        <span className="font-bold text-white">₹{monthlyBudget.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-400">Total Income</span>
                                        <span className="font-bold text-green-400">+₹{monthlyIncome.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-3">
                                        <span className="text-slate-400">Total Spent</span>
                                        <span className="font-bold text-red-400">-₹{monthlySpent.toLocaleString()}</span>
                                    </div>
                                    <div className="border-t border-white/5 pt-3 flex justify-between">
                                        <span className="text-sm text-slate-300 font-medium">Safe to Spend</span>
                                        <span className="font-black text-amber-400">₹{remainingSavings.toLocaleString()}</span>
                                    </div>
                                </div>
                                <p className="text-slate-400 text-center text-sm leading-relaxed mb-8">
                                    This transaction will exceed your calculated monthly savings target by <span className="text-amber-300 font-bold">₹{(enteredAmount - remainingSavings).toLocaleString()}</span>.
                                </p>

                                {/* Actions */}
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={saveTransaction}
                                        className="w-full px-4 py-4 rounded-2xl font-black text-white bg-amber-500 hover:bg-amber-400 shadow-xl shadow-amber-500/20 transition-all"
                                    >
                                        Proceed Anyway
                                    </button>
                                    <button
                                        onClick={() => setShowBudgetWarning(false)}
                                        className="w-full px-4 py-4 rounded-2xl font-bold bg-white/5 hover:bg-white/10 text-white transition-all"
                                    >
                                        Go Back
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Expenses;
