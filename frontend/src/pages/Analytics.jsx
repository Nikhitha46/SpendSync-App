import React, { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { PieChart as PieChartIcon, Calendar, ArrowRight, BarChart3 } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

const Analytics = () => {
    const [analytics, setAnalytics] = useState(null);
    const [budget, setBudget] = useState(0);
    const [loading, setLoading] = useState(true);
    const [viewType, setViewType] = useState('monthly'); // 'monthly' or 'range'
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [rangeSpan, setRangeSpan] = useState('6'); // months

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            let params = {};
            
            if (viewType === 'monthly') {
                params.month = month;
            } else {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setMonth(startDate.getMonth() - parseInt(rangeSpan));
                params.startDate = startDate.toISOString();
                params.endDate = endDate.toISOString();
            }

            const [analyticsRes, budgetRes] = await Promise.all([
                api.get('/analytics', { params }),
                viewType === 'monthly' 
                    ? api.get(`/budget?month=${month}`).catch(() => ({ data: null }))
                    : Promise.resolve({ data: null })
            ]);
            
            setAnalytics(analyticsRes.data);
            setBudget(budgetRes.data?.amount || 0);
        } catch (error) {
            console.error("Failed to load analytics data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [month, viewType, rangeSpan]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    const { categoryBreakdown, dailyBurn, totalExpenses, totalIncome } = analytics || { categoryBreakdown: [], dailyBurn: [], totalExpenses: 0, totalIncome: 0 };
    const netSavings = (budget || 0) + totalIncome - totalExpenses;

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-10">
            <header className="flex flex-col md:flex-row md:justify-between items-start md:items-end space-y-6 md:space-y-0 px-1">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white flex items-center">
                        <BarChart3 className="w-8 h-8 mr-3 text-primary" />
                        Financial Insights
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Deep dive into your financial habits and trends</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* View Type Toggle */}
                    <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl">
                        <button 
                            onClick={() => setViewType('monthly')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewType === 'monthly' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Monthly
                        </button>
                        <button 
                            onClick={() => setViewType('range')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewType === 'range' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Span
                        </button>
                    </div>

                    {viewType === 'monthly' ? (
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-hover:text-primary transition-colors pointer-events-none" />
                            <input 
                                type="month" 
                                className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-primary outline-none [color-scheme:dark] cursor-pointer"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-hover:text-primary transition-colors pointer-events-none" />
                            <select 
                                className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-2xl pl-11 pr-8 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
                                value={rangeSpan}
                                onChange={(e) => setRangeSpan(e.target.value)}
                            >
                                <option value="3" className="bg-surface">Last 3 Months</option>
                                <option value="6" className="bg-surface">Last 6 Months</option>
                                <option value="12" className="bg-surface">Last 1 Year</option>
                            </select>
                        </div>
                    )}
                </div>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard title={viewType === 'monthly' ? "Monthly Budget" : "Avg Budget"} value={budget || 0} color="text-slate-400" />
                <StatCard title="Total Income" value={totalIncome} color="text-secondary" />
                <StatCard title="Total Debits" value={totalExpenses} color="text-danger" />
                <StatCard title="Net Savings" value={netSavings} color={netSavings >= 0 ? 'text-primary' : 'text-danger'} prefix={netSavings >= 0 ? '+' : ''} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mt-4 md:mt-8">
                {/* Category Breakdown - Bar Chart */}
                <div className="bg-surface/50 border border-white/5 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-white tracking-tight">Spending by Category</h3>
                        <div className="p-2 bg-primary/10 rounded-xl">
                           <PieChartIcon className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                    {categoryBreakdown.length > 0 ? (
                        <div className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 20, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        stroke="#94A3B8" 
                                        fontSize={12}
                                        width={100}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip 
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                        contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
                                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                        formatter={(value) => [`₹${value.toLocaleString()}`, 'Spent']}
                                    />
                                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                                        {categoryBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[320px] flex items-center justify-center text-slate-500 font-medium">
                            No expense data found for this selection
                        </div>
                    )}
                </div>

                {/* Daily Spending Trend */}
                <div className="bg-surface/50 border border-white/5 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-secondary/10 transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-white tracking-tight">Spending Trajectory</h3>
                        <div className="p-2 bg-secondary/10 rounded-xl">
                           <ArrowRight className="w-5 h-5 text-secondary" />
                        </div>
                    </div>
                    {dailyBurn.length > 0 ? (
                        <div className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dailyBurn}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke="#64748B" 
                                        fontSize={10}
                                        tickFormatter={(str) => {
                                            const d = new Date(str);
                                            return viewType === 'monthly' ? d.getDate() : `${d.getMonth() + 1}/${d.getDate()}`;
                                        }}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis 
                                        stroke="#64748B" 
                                        fontSize={10}
                                        tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`}
                                        tickLine={false}
                                        axisLine={false}
                                        dx={-5}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px' }}
                                        formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount']}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="amount" 
                                        stroke="#3B82F6" 
                                        strokeWidth={4}
                                        dot={false}
                                        activeDot={{ r: 6, fill: '#3B82F6', strokeWidth: 0 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[320px] flex items-center justify-center text-slate-500 font-medium">
                            No spending trends recorded yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, color, prefix = '' }) => (
    <div className="bg-surface/40 border border-white/5 p-5 md:p-6 rounded-3xl shadow-xl hover:bg-surface/60 transition-all">
        <p className="text-slate-500 text-xs md:text-sm font-bold uppercase tracking-widest mb-2">{title}</p>
        <h4 className={`text-xl md:text-2xl font-black tracking-tighter ${color}`}>
            {prefix}₹{value.toLocaleString()}
        </h4>
    </div>
);

export default Analytics;
