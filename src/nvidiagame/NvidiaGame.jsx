import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Cpu, Box, Truck, AlertTriangle, TrendingUp, Activity, 
  Factory, ShoppingCart, DollarSign, Play, RotateCcw, CheckCircle, Bot, BrainCircuit 
} from 'lucide-react';

// --- Constants & Config ---
const MAX_WEEKS = 20;
const LEAD_TIME = 2; // Weeks for both delivery to User and Production for Supplier
const HOLDING_COST = 5; // $ per unit per week
const BACKLOG_COST = 20; // $ per unit per week
const ORDER_CAP_PER_COMPONENT = 500;
const INITIAL_INVENTORY = 100;
const API_KEY = ""; // System will provide key at runtime

// Pre-defined exogenous demand curve (Sigmoid-like ramp up)
const DEMAND_CURVE = [
  50, 50, 60, 80, 100, 120, 150, 200, 250, 300, 
  300, 320, 310, 300, 280, 260, 250, 250, 250, 250
];

export default function App() {
  // --- State ---
  const [week, setWeek] = useState(0);
  const [gameState, setGameState] = useState('start'); // 'start', 'playing', 'gameover'
  const [turnPhase, setTurnPhase] = useState('player_turn'); // 'player_turn', 'ai_turn', 'resolving'
  
  // User (Blackwell) State
  const [inventory, setInventory] = useState({ cowos: INITIAL_INVENTORY, hbm: INITIAL_INVENTORY });
  const [blackwellBacklog, setBlackwellBacklog] = useState(0);
  const [userShipments, setUserShipments] = useState([]); // Arriving to User
  
  // Supplier State (AI Controlled)
  // Each supplier has: inventory, backlog (owed to User), incomingProduction (arriving to Supplier)
  const [suppliers, setSuppliers] = useState({
    cowos: { inventory: 200, backlog: 0, incomingProduction: [] },
    hbm: { inventory: 200, backlog: 0, incomingProduction: [] }
  });

  // Financials & History
  const [score, setScore] = useState({ current: 0, total: 0 });
  const [history, setHistory] = useState([]); 
  
  // Inputs
  const [orders, setOrders] = useState({ cowos: 0, hbm: 0 });
  
  // Logs & AI Reasoning
  const [logs, setLogs] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiReasoning, setAiReasoning] = useState({ cowos: null, hbm: null });
  
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- AI Logic ---

  const getAITurn = async (role, currentStats, incomingDemand, lastWeeksData) => {
    if (!API_KEY) {
      // Fallback if no API key
      const safeOrder = Math.max(0, incomingDemand - currentStats.inventory + currentStats.backlog);
      return { order: safeOrder, reasoning: "API Key missing. Defaulting to match demand." };
    }

    const prompt = `
      You are the Supply Chain Manager for the ${role} Factory.
      Your goal is to minimize total costs (Holding Cost: $${HOLDING_COST}/unit, Backlog Cost: $${BACKLOG_COST}/unit).
      Avoid the Bullwhip Effect: Do not panic order if demand spikes temporarily. Smooth your production.
      
      Current State:
      - Week: ${week}
      - Your Inventory: ${currentStats.inventory} units
      - Unfilled Backlog (Owed to NVIDIA): ${currentStats.backlog} units
      - Incoming Demand (New Order from NVIDIA): ${incomingDemand} units
      - Incoming Production (Arriving next 2 weeks): ${currentStats.incomingProduction.map(p => p.amount).join(', ')}
      
      Recent History: ${JSON.stringify(lastWeeksData.slice(-3))}
      
      Decide your PRODUCTION ORDER (Integer 0-${ORDER_CAP_PER_COMPONENT}).
      Response Format (JSON only): { "order": integer, "reasoning": "short string under 100 chars" }
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return JSON.parse(text);
      }
      throw new Error("No text");
    } catch (e) {
      console.error("AI Error", e);
      // Fallback strategy: Target inventory of 200
      const target = 200;
      const pipeline = currentStats.incomingProduction.reduce((a, b) => a + b.amount, 0);
      const needed = Math.max(0, (target + currentStats.backlog + incomingDemand) - (currentStats.inventory + pipeline));
      return { order: Math.min(needed, ORDER_CAP_PER_COMPONENT), reasoning: "Connection failed. Using heuristic fallback." };
    }
  };

  // --- Game Loop Hooks ---

  useEffect(() => {
    const runAITurn = async () => {
      if (turnPhase !== 'ai_turn') return;
      
      setAiThinking(true);
      
      // Delay to simulate thinking
      await new Promise(r => setTimeout(r, 1500));

      const lastHistory = history.slice(-3);

      // Parallel AI calls
      const [cowosDecision, hbmDecision] = await Promise.all([
        getAITurn('CoWoS', suppliers.cowos, orders.cowos, lastHistory),
        getAITurn('HBM', suppliers.hbm, orders.hbm, lastHistory)
      ]);

      // Resolve the week with AI decisions
      resolveWeek(cowosDecision, hbmDecision);
    };

    runAITurn();
  }, [turnPhase]);

  // --- Core Game Logic ---

  const startGame = () => {
    setWeek(1);
    setGameState('playing');
    setTurnPhase('player_turn');
    setInventory({ cowos: INITIAL_INVENTORY, hbm: INITIAL_INVENTORY });
    setSuppliers({
        cowos: { inventory: 200, backlog: 0, incomingProduction: [] },
        hbm: { inventory: 200, backlog: 0, incomingProduction: [] }
    });
    setBlackwellBacklog(0);
    setUserShipments([]);
    setScore({ current: 0, total: 0 });
    setHistory([]);
    setOrders({ cowos: 0, hbm: 0 });
    setLogs([{ week: 1, text: "Simulation started. You are Blackwell. Order components from AI suppliers.", source: "System" }]);
    setAiReasoning({ cowos: null, hbm: null });
  };

  const handlePlayerSubmit = () => {
    if (gameState !== 'playing' || turnPhase !== 'player_turn') return;
    setTurnPhase('ai_turn');
  };

  const resolveWeek = (cowosDecision, hbmDecision) => {
    if (week > MAX_WEEKS) return;

    const nextLog = [];
    const newSuppliers = { ...suppliers };
    let newUserShipments = [...userShipments];

    // --- 1. USER RECEIVING (Shipments arrive at NVIDIA) ---
    const userArriving = userShipments.filter(s => s.arrivalWeek === week);
    const userPending = userShipments.filter(s => s.arrivalWeek !== week);
    
    let userCoWoS = inventory.cowos;
    let userHBM = inventory.hbm;
    let arrivedCoWoS = 0;
    let arrivedHBM = 0;

    userArriving.forEach(s => {
      if (s.type === 'cowos') { userCoWoS += s.amount; arrivedCoWoS += s.amount; }
      else { userHBM += s.amount; arrivedHBM += s.amount; }
    });

    // --- 2. USER PRODUCTION (NVIDIA Assembly) ---
    const maxProduction = Math.min(userCoWoS, userHBM);
    const currentDemand = DEMAND_CURVE[week - 1] || 0;
    const totalDemandNeeded = currentDemand + blackwellBacklog;
    const fulfilled = Math.min(totalDemandNeeded, maxProduction);
    
    userCoWoS -= fulfilled;
    userHBM -= fulfilled;
    const newBacklog = totalDemandNeeded - fulfilled;

    // --- 3. SUPPLIER LOGIC (The Beer Game Nodes) ---
    const processSupplier = (type, userOrder, aiDecision, currentSupplierState) => {
      let { inventory, backlog, incomingProduction } = currentSupplierState;
      
      // A. Receive Supplier's Own Production (arriving this week)
      const supplierArriving = incomingProduction.filter(p => p.arrivalWeek === week);
      const supplierPending = incomingProduction.filter(p => p.arrivalWeek !== week);
      
      supplierArriving.forEach(p => inventory += p.amount);

      // B. Fulfill User Order
      const totalOwed = userOrder + backlog;
      const canShip = Math.min(totalOwed, inventory);
      
      inventory -= canShip;
      const newBacklog = totalOwed - canShip;

      // Ship to User (Arrives in LEAD_TIME weeks)
      if (canShip > 0) {
        newUserShipments.push({
          type,
          amount: canShip,
          arrivalWeek: week + LEAD_TIME
        });
      }

      // C. Place New Production Order (AI Decision)
      if (aiDecision.order > 0) {
        supplierPending.push({
          amount: aiDecision.order,
          arrivalWeek: week + LEAD_TIME
        });
      }

      return {
        state: { inventory, backlog: newBacklog, incomingProduction: supplierPending },
        shipped: canShip
      };
    };

    const cowosUpdate = processSupplier('cowos', orders.cowos, cowosDecision, suppliers.cowos);
    const hbmUpdate = processSupplier('hbm', orders.hbm, hbmDecision, suppliers.hbm);

    // --- 4. COSTS ---
    const currentHoldingCost = (userCoWoS + userHBM) * HOLDING_COST;
    const currentBacklogCost = newBacklog * BACKLOG_COST;
    const weeklyCost = currentHoldingCost + currentBacklogCost;
    const newTotalScore = score.total + weeklyCost;

    // --- 5. LOGGING & HISTORY ---
    if (arrivedCoWoS > 0 || arrivedHBM > 0) {
      nextLog.push({ week, text: `Received: ${arrivedCoWoS} CoWoS, ${arrivedHBM} HBM.`, source: "Logistics" });
    }
    nextLog.push({ week, text: `AI CoWoS: "${cowosDecision.reasoning}" (Prod: ${cowosDecision.order})`, source: "AI CoWoS" });
    nextLog.push({ week, text: `AI HBM: "${hbmDecision.reasoning}" (Prod: ${hbmDecision.order})`, source: "AI HBM" });

    // Update State
    setInventory({ cowos: userCoWoS, hbm: userHBM });
    setBlackwellBacklog(newBacklog);
    setUserShipments(newUserShipments);
    setSuppliers({ cowos: cowosUpdate.state, hbm: hbmUpdate.state });
    setScore({ current: weeklyCost, total: newTotalScore });
    setAiReasoning({ cowos: cowosDecision.reasoning, hbm: hbmDecision.reasoning });
    
    setHistory(prev => [...prev, {
      week,
      demand: currentDemand,
      fulfilled,
      backlog: newBacklog,
      inventoryCoWoS: userCoWoS,
      inventoryHBM: userHBM,
      ordersCoWoS: orders.cowos,
      ordersHBM: orders.hbm,
      supplierCoWoSInv: cowosUpdate.state.inventory, // Track hidden stats for chart?
      cost: weeklyCost
    }]);

    setLogs(prev => [...prev, ...nextLog]);
    setOrders({ cowos: 0, hbm: 0 }); // Reset inputs
    setAiThinking(false);

    if (week === MAX_WEEKS) {
      setGameState('gameover');
      setTurnPhase('gameover');
    } else {
      setWeek(w => w + 1);
      setTurnPhase('player_turn');
    }
  };

  // --- Components ---

  const KPICard = ({ title, value, subtext, icon: Icon, color = "text-white", alert = false }) => (
    <div className={`bg-gray-800 p-4 rounded-xl border ${alert ? 'border-red-500 animate-pulse' : 'border-gray-700'} flex items-start justify-between`}>
      <div>
        <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
        {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
      </div>
      <div className={`p-2 rounded-lg bg-gray-700/50 ${color}`}>
        <Icon size={20} />
      </div>
    </div>
  );

  const canSubmit = orders.cowos >= 0 && orders.hbm >= 0 && turnPhase === 'player_turn';

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-[#76B900] selection:text-black">
      
      {/* HEADER */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#76B900] rounded flex items-center justify-center">
              <Cpu className="text-black" size={20} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">NVIDIA <span className="text-[#76B900]">BLACKWELL</span> OPS</h1>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[#76B900]" />
              <span className="text-gray-400">Week:</span>
              <span className="font-mono text-xl font-bold">{week}/{MAX_WEEKS}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-red-400" />
              <span className="text-gray-400">Total Cost:</span>
              <span className="font-mono text-xl font-bold text-red-400">${score.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">

        {/* --- LEFT COLUMN: PLAYER CONTROL --- */}
        <div className="lg:col-span-3 space-y-6">
          
          <section className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <h2 className="text-[#76B900] text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Factory size={16} /> Assembly Status
            </h2>
            
            <div className="space-y-3">
              <KPICard 
                title="B.CoWoS Stock" 
                value={inventory.cowos} 
                icon={Box} 
                color="text-blue-400"
                subtext="Advanced Packaging"
                alert={inventory.cowos === 0}
              />
              <KPICard 
                title="B.HBM Stock" 
                value={inventory.hbm} 
                icon={Box} 
                color="text-purple-400"
                subtext="High Bandwidth Memory"
                alert={inventory.hbm === 0}
              />
              <KPICard 
                title="Backlog" 
                value={blackwellBacklog} 
                icon={AlertTriangle} 
                color="text-red-500"
                subtext="Unmet Demand"
                alert={blackwellBacklog > 50}
              />
            </div>
          </section>

          <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg relative overflow-hidden">
            {turnPhase === 'ai_turn' && (
               <div className="absolute inset-0 bg-black/60 z-10 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in">
                 <Bot size={48} className="text-[#76B900] animate-bounce mb-2" />
                 <span className="font-mono font-bold text-[#76B900] animate-pulse">AI THINKING...</span>
               </div>
            )}

            <div className="absolute top-0 left-0 w-1 h-full bg-[#76B900]"></div>
            <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
              <ShoppingCart size={18} /> Place Orders
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Order CoWoS</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={orders.cowos}
                    onChange={(e) => setOrders(p => ({...p, cowos: parseInt(e.target.value)||0}))}
                    disabled={turnPhase !== 'player_turn'}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-[#76B900] transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Order HBM</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={orders.hbm}
                    onChange={(e) => setOrders(p => ({...p, hbm: parseInt(e.target.value)||0}))}
                    disabled={turnPhase !== 'player_turn'}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-[#76B900] transition-colors font-mono"
                  />
                </div>
              </div>

              <button 
                onClick={handlePlayerSubmit}
                disabled={!canSubmit}
                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                  canSubmit 
                    ? 'bg-[#76B900] text-black hover:bg-[#6aa600] shadow-[0_0_15px_rgba(118,185,0,0.3)]' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {turnPhase === 'ai_turn' ? 'Opponent Turn' : 'Submit Orders'} <Play size={16} fill="currentColor" />
              </button>
            </div>
          </section>
        </div>

        {/* --- CENTER COLUMN: DASHBOARD & LOGS --- */}
        <div className="lg:col-span-6 space-y-6 flex flex-col">
          
          {/* Main Chart */}
          <section className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 flex-1 min-h-[300px]">
            <h2 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} /> Supply Chain Dynamics
            </h2>
            <div className="h-64 w-full">
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="week" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }} 
                    />
                    <Legend />
                    <Line type="monotone" dataKey="demand" stroke="#76B900" strokeWidth={2} dot={false} name="Market Demand" />
                    <Line type="monotone" dataKey="fulfilled" stroke="#fff" strokeWidth={2} dot={false} name="Fulfilled" />
                    <Line type="step" dataKey="ordersCoWoS" stroke="#60A5FA" strokeDasharray="5 5" dot={false} name="User Order (CoWoS)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600">
                  Awaiting Data...
                </div>
              )}
            </div>
          </section>

          {/* AI Reasoning Log */}
          <section className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 h-64 overflow-y-auto">
             <h2 className="text-yellow-500 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <BrainCircuit size={16} /> AI Strategy Reasoning
            </h2>
            <div className="space-y-3 font-mono text-xs">
              {aiReasoning.cowos ? (
                <>
                  <div className="bg-gray-900/50 p-3 rounded border-l-2 border-blue-500">
                    <strong className="block text-blue-400 mb-1">CoWoS Supplier Agent:</strong>
                    "{aiReasoning.cowos}"
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded border-l-2 border-purple-500">
                    <strong className="block text-purple-400 mb-1">HBM Supplier Agent:</strong>
                    "{aiReasoning.hbm}"
                  </div>
                </>
              ) : (
                <div className="text-gray-500 italic">No active reasoning data. Waiting for AI turn...</div>
              )}
            </div>
          </section>

          {/* System Logs */}
          <section className="bg-black rounded-xl border border-gray-700 p-4 h-48 overflow-y-auto font-mono text-xs">
            <h3 className="text-gray-500 uppercase font-bold mb-2 sticky top-0 bg-black py-1">System Log</h3>
            <div className="space-y-1.5">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-[#76B900] w-12 shrink-0">Wk {log.week}</span>
                  <span className={`
                    ${log.source.includes('AI') ? 'text-yellow-500' : 
                      log.source === 'System' ? 'text-gray-400' : 'text-blue-400'}
                  `}>[{log.source}]</span>
                  <span className="text-gray-300">{log.text}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </section>
        </div>

        {/* --- RIGHT COLUMN: SUPPLIER AI --- */}
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <h2 className="text-blue-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Truck size={16} /> Incoming to NVIDIA
            </h2>
            <div className="space-y-2">
               {userShipments.filter(s => s.arrivalWeek > week).length === 0 ? (
                 <div className="text-sm text-gray-500 italic py-4 text-center">No shipments en route.</div>
               ) : (
                 userShipments
                  .filter(s => s.arrivalWeek > week)
                  .sort((a,b) => a.arrivalWeek - b.arrivalWeek)
                  .map((s, idx) => (
                    <div key={idx} className="bg-gray-700/30 p-3 rounded-lg flex justify-between items-center text-sm border-l-2 border-blue-500">
                      <div>
                        <div className="text-gray-300 font-bold">{s.type === 'cowos' ? 'CoWoS Pkg' : 'HBM Stack'}</div>
                        <div className="text-xs text-gray-500">Arrives Week {s.arrivalWeek}</div>
                      </div>
                      <div className="font-mono text-white bg-gray-700 px-2 py-1 rounded">{s.amount}</div>
                    </div>
                 ))
               )}
            </div>
          </section>

          <section className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <h2 className="text-yellow-500 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={16} /> Supplier AI Status
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-900 rounded border border-gray-700">
                <span className="text-xs font-bold text-gray-400">CoWoS Agent</span>
                <span className="text-xs px-2 py-1 rounded font-bold bg-green-900 text-green-400">
                  {turnPhase === 'ai_turn' ? 'Thinking...' : 'Waiting'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-900 rounded border border-gray-700">
                <span className="text-xs font-bold text-gray-400">HBM Agent</span>
                 <span className="text-xs px-2 py-1 rounded font-bold bg-green-900 text-green-400">
                  {turnPhase === 'ai_turn' ? 'Thinking...' : 'Waiting'}
                </span>
              </div>
              <div className="p-3 bg-gray-900/50 border border-gray-800 rounded text-xs text-gray-500">
                <p>AI Agents manage upstream inventory constraints. Your orders are fulfilled from their available stock.</p>
              </div>
            </div>
          </section>
        </div>

      </main>

      {/* MODALS */}
      
      {/* START SCREEN */}
      {gameState === 'start' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-[#76B900] p-8 rounded-2xl max-w-lg w-full text-center shadow-[0_0_50px_rgba(118,185,0,0.15)]">
            <Cpu size={64} className="text-[#76B900] mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-2">Blackwell Supply Chain Sim</h1>
            <p className="text-gray-400 mb-8">
              Play as NVIDIA. Manage CoWoS & HBM orders. <br/>
              <span className="text-[#76B900]">New:</span> Upstream suppliers are now AI Agents (Gemini) that manage their own inventory.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left mb-8 bg-gray-800 p-4 rounded-lg text-sm">
              <div>
                <span className="text-gray-500 block">Lead Time</span>
                <span className="text-white font-bold">2 Wks (Both Ways)</span>
              </div>
              <div>
                <span className="text-gray-500 block">Holding Cost</span>
                <span className="text-white font-bold">${HOLDING_COST} /unit</span>
              </div>
              <div>
                <span className="text-gray-500 block">Backlog Cost</span>
                <span className="text-red-400 font-bold">${BACKLOG_COST} /unit</span>
              </div>
              <div>
                <span className="text-gray-500 block">Opponent</span>
                <span className="text-white font-bold">Gemini AI</span>
              </div>
            </div>
            <button 
              onClick={startGame}
              className="w-full bg-[#76B900] text-black font-bold py-4 rounded-xl hover:bg-[#6aa600] transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              Initialize Simulation <Play size={20} />
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === 'gameover' && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl max-w-lg w-full text-center">
            <div className="inline-block p-4 rounded-full bg-gray-800 mb-6">
              <CheckCircle size={48} className="text-[#76B900]" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Simulation Complete</h2>
            <p className="text-gray-400 mb-8">20 Weeks concluded.</p>
            
            <div className="bg-gray-800 rounded-xl p-6 mb-8">
              <span className="block text-gray-500 text-sm uppercase font-bold mb-1">Final Cost Score</span>
              <span className="text-4xl font-mono font-bold text-white">${score.total.toLocaleString()}</span>
              
              <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400 flex justify-between">
                <span>Avg Backlog: {Math.round(history.reduce((a,b) => a + b.backlog, 0) / MAX_WEEKS)} units</span>
                <span>Avg Inventory: {Math.round(history.reduce((a,b) => a + b.inventoryCoWoS + b.inventoryHBM, 0) / MAX_WEEKS)} units</span>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} /> Restart Simulation
            </button>
          </div>
        </div>
      )}

    </div>
  );
}