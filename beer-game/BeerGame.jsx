import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Package, 
  ShoppingCart, 
  AlertCircle, 
  ArrowRight, 
  Users, 
  TrendingUp, 
  History,
  CheckCircle2,
  Play
} from 'lucide-react';

// --- CONSTANTS & CONFIGURATION ---

const ROLES = [
  { id: 'retailer', label: 'Retailer', color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-500/30' },
  { id: 'wholesaler', label: 'Wholesaler', color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-500/30' },
  { id: 'distributor', label: 'Distributor', color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-500/30' },
  { id: 'manufacturer', label: 'Manufacturer', color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-500/30' }
];

const CONFIG = {
  initialInventory: 12,
  initialBacklog: 0,
  shippingDelay: 2, // Weeks for goods to travel downstream
  orderDelay: 1,    // Weeks for orders to travel upstream
  totalWeeks: 20,
  costHolding: 0.5,
  costBacklog: 1.0,
};

// --- HELPER FUNCTIONS ---

// The "Secret" Demand Curve
const getConsumerDemand = (week) => {
  if (week <= 4) return 4;
  return 8; // Step jump at week 5
};

// --- MAIN COMPONENT ---

export default function BeerGame() {
  const [gameState, setGameState] = useState('INTRO'); // INTRO, HANDOFF, PLAY, SUMMARY, GAME_OVER
  const [currentWeek, setCurrentWeek] = useState(1);
  const [turnIndex, setTurnIndex] = useState(0); // 0 to 3 matching ROLES
  
  // History is the single source of truth.
  // We seed it with Week -1 and Week 0 to handle initial lookbacks (delays).
  // Equilibrium start: Everyone ordering 4, shipping 4, holding 12.
  const [history, setHistory] = useState(() => {
    const seedData = [];
    for (let w = -1; w <= 0; w++) {
      ROLES.forEach(role => {
        seedData.push({
          week: w,
          roleId: role.id,
          inventory: 12,
          backlog: 0,
          orderPlaced: 4,
          shipped: 4,
          cost: 6 // 12 * 0.5
        });
      });
    }
    return seedData;
  });

  const [orderInput, setOrderInput] = useState('');

  // --- LOGIC: RETRIEVAL ---

  const getHistoryEntry = (week, roleId) => {
    return history.find(h => h.week === week && h.roleId === roleId);
  };

  // Logic: Incoming Shipment (Looking Upstream, 2 weeks ago)
  const getIncomingShipment = (roleIndex, week) => {
    const shipmentDelayWeek = week - CONFIG.shippingDelay;
    
    // Manufacturer "ships" to themselves based on production requests (orders) from 2 weeks ago
    if (roleIndex === 3) {
      const selfHistory = getHistoryEntry(shipmentDelayWeek, ROLES[3].id);
      return selfHistory ? selfHistory.orderPlaced : 4; 
    }

    // Others receive what the upstream supplier SHIPPED 2 weeks ago
    const upstreamRole = ROLES[roleIndex + 1];
    const upstreamHistory = getHistoryEntry(shipmentDelayWeek, upstreamRole.id);
    return upstreamHistory ? upstreamHistory.shipped : 4;
  };

  // Logic: Incoming Demand (Looking Downstream, 1 week ago)
  const getIncomingDemand = (roleIndex, week) => {
    // Retailer receives direct consumer demand
    if (roleIndex === 0) {
      return getConsumerDemand(week);
    }

    // Others receive orders placed by downstream customer 1 week ago
    const orderDelayWeek = week - CONFIG.orderDelay;
    const downstreamRole = ROLES[roleIndex - 1];
    const downstreamHistory = getHistoryEntry(orderDelayWeek, downstreamRole.id);
    return downstreamHistory ? downstreamHistory.orderPlaced : 4;
  };

  // --- LOGIC: GAME PLAY ---

  const handleStartGame = () => {
    setGameState('HANDOFF');
    setCurrentWeek(1);
    setTurnIndex(0);
    // Reset history to seed only
    const seedData = [];
    for (let w = -1; w <= 0; w++) {
      ROLES.forEach(role => {
        seedData.push({
          week: w,
          roleId: role.id,
          inventory: 12,
          backlog: 0,
          orderPlaced: 4,
          shipped: 4,
          cost: 6
        });
      });
    }
    setHistory(seedData);
  };

  const submitTurn = (e) => {
    e.preventDefault();
    const orderAmount = parseInt(orderInput);
    if (isNaN(orderAmount) || orderAmount < 0) return;

    const currentRole = ROLES[turnIndex];
    const prevWeekData = getHistoryEntry(currentWeek - 1, currentRole.id);

    // 1. Calculate Incomings
    const shipmentReceived = getIncomingShipment(turnIndex, currentWeek);
    const demandReceived = getIncomingDemand(turnIndex, currentWeek);

    // 2. Calculate State
    // Available to sell = Old Inventory + New Shipment
    const totalAvailable = prevWeekData.inventory + shipmentReceived;
    // Total Obligation = New Demand + Old Backlog
    const totalToShip = demandReceived + prevWeekData.backlog;

    // 3. Determine Shipments & New Stock
    const actuallyShipped = Math.min(totalAvailable, totalToShip);
    
    let newInventory = totalAvailable - actuallyShipped;
    let newBacklog = totalToShip - actuallyShipped;

    // 4. Calculate Costs
    const weekCost = (newInventory * CONFIG.costHolding) + (newBacklog * CONFIG.costBacklog);

    // 5. Commit to History
    const newEntry = {
      week: currentWeek,
      roleId: currentRole.id,
      inventory: newInventory,
      backlog: newBacklog,
      orderPlaced: orderAmount,
      shipped: actuallyShipped,
      cost: weekCost
    };

    setHistory(prev => [...prev, newEntry]);
    setOrderInput('');

    // 6. Advance Turn
    if (turnIndex < 3) {
      setTurnIndex(prev => prev + 1);
      setGameState('HANDOFF');
    } else {
      setGameState('SUMMARY');
    }
  };

  const startNextWeek = () => {
    if (currentWeek >= CONFIG.totalWeeks) {
      setGameState('GAME_OVER');
    } else {
      setCurrentWeek(prev => prev + 1);
      setTurnIndex(0);
      setGameState('HANDOFF');
    }
  };

  // --- RENDERERS ---

  if (gameState === 'INTRO') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-amber-500/20 rounded-full">
              <Package className="w-12 h-12 text-amber-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2 text-white">The Beer Game</h1>
          <p className="text-slate-400 text-center mb-8 text-lg">Supply Chain & Bullwhip Effect Simulation</p>
          
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-400 mt-1" />
              <p><strong>4 Players needed:</strong> Retailer, Wholesaler, Distributor, Manufacturer.</p>
            </div>
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-emerald-400 mt-1" />
              <p><strong>The Goal:</strong> Minimize total team costs. Don't run out of stock, but don't hold too much inventory.</p>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-1" />
              <p><strong>Delays:</strong> Shipping takes 2 weeks. Orders take 1 week to reach your supplier.</p>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-amber-400 mt-1" />
              <p><strong>Costs:</strong> $0.50 to hold an item. $1.00 for backlog (items you owe).</p>
            </div>
          </div>

          <button 
            onClick={handleStartGame}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" /> Start Simulation
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'HANDOFF') {
    const currentRole = ROLES[turnIndex];
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className={`w-full max-w-md p-8 rounded-2xl border-2 text-center shadow-2xl ${currentRole.bg} ${currentRole.border}`}>
          <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Week {currentWeek}</h2>
          <h1 className={`text-4xl font-bold mb-6 ${currentRole.color}`}>{currentRole.label}</h1>
          <p className="text-slate-300 mb-8">Pass the device to the {currentRole.label}.</p>
          <button 
            onClick={() => setGameState('PLAY')}
            className="w-full bg-slate-100 hover:bg-white text-slate-900 font-bold py-3 rounded-lg transition-colors"
          >
            I am the {currentRole.label}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'PLAY') {
    const role = ROLES[turnIndex];
    const prevData = getHistoryEntry(currentWeek - 1, role.id);
    const incomingShipment = getIncomingShipment(turnIndex, currentWeek);
    const incomingDemand = getIncomingDemand(turnIndex, currentWeek);
    const projectedAvailable = prevData.inventory + incomingShipment;
    
    // Calculate live preview of calculations
    const projectedBacklog = prevData.backlog + incomingDemand;
    
    // Get historical data for this role (excluding seed data week -1, 0)
    const roleHistory = history.filter(h => h.roleId === role.id && h.week > 0 && h.week < currentWeek);
    
    // We only show what is ABOUT to happen before they decide their order
    
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
        <div className="max-w-xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-700">
            <div>
              <div className="text-slate-400 text-xs uppercase tracking-widest">Current Role</div>
              <div className={`text-2xl font-bold ${role.color}`}>{role.label}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 text-xs uppercase tracking-widest">Timeline</div>
              <div className="text-2xl font-bold text-white">Week {currentWeek}</div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Package className="w-4 h-4" /> <span>Current Stock</span>
              </div>
              <div className="text-3xl font-mono font-bold text-emerald-400">{prevData.inventory}</div>
              <div className="text-xs text-slate-500 mt-1">Holding Cost: ${(prevData.inventory * CONFIG.costHolding).toFixed(2)}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <AlertCircle className="w-4 h-4" /> <span>Backlog</span>
              </div>
              <div className="text-3xl font-mono font-bold text-red-400">{prevData.backlog}</div>
              <div className="text-xs text-slate-500 mt-1">Penalty Cost: ${(prevData.backlog * CONFIG.costBacklog).toFixed(2)}</div>
            </div>
          </div>

          {/* Incoming Flow */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase">This Week's Flow</h3>
            
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border-l-4 border-emerald-500">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-emerald-500" />
                <span className="font-medium">Incoming Shipment</span>
              </div>
              <span className="text-xl font-bold text-white">+{incomingShipment}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border-l-4 border-amber-500">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                <span className="font-medium">Incoming Order</span>
              </div>
              <span className="text-xl font-bold text-white">-{incomingDemand}</span>
            </div>
          </div>

          {/* NEW: Historical Graphs (Only show after Week 1) */}
          {roleHistory.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {/* Order History Graph */}
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-2 tracking-wider">Your Order History</p>
                <div className="flex-1 min-h-[80px] flex items-end gap-1">
                  {roleHistory.map(h => (
                    <div key={h.week} className="flex-1 bg-amber-500/80 rounded-t-sm relative group hover:bg-amber-400 transition-colors" 
                         style={{ height: `${Math.min((h.orderPlaced / 15) * 100, 100)}%` }}>
                       {/* Tooltip */}
                       <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-[10px] px-1.5 py-0.5 rounded border border-slate-600 whitespace-nowrap z-10">
                         W{h.week}: {h.orderPlaced}
                       </div>
                    </div>
                  ))}
                  {/* Placeholder for current week */}
                  <div className="flex-1 bg-slate-700/30 rounded-t-sm h-full border-b border-slate-600 flex items-end justify-center">
                    <span className="text-[8px] text-slate-500 mb-1">?</span>
                  </div>
                </div>
              </div>

              {/* Net Stock Graph */}
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                   <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Net Stock</p>
                   <div className="flex gap-1">
                     <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                     <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                   </div>
                </div>
                <div className="flex-1 min-h-[80px] relative flex items-center gap-1 border-t border-slate-600/30">
                  <div className="absolute top-1/2 w-full h-px bg-slate-600/50"></div>
                  {roleHistory.map(h => {
                    const net = h.inventory - h.backlog;
                    const isPos = net >= 0;
                    // Scale: Max height at +/- 20 units
                    const pct = Math.min((Math.abs(net) / 20) * 45, 45); 
                    return (
                      <div key={h.week} className="flex-1 h-full relative group">
                        <div 
                          className={`absolute w-full rounded-sm ${isPos ? 'bg-emerald-500/80' : 'bg-red-500/80'}`}
                          style={{
                            height: `${Math.max(pct, 2)}%`, // Minimum 2% visibility
                            bottom: isPos ? '50%' : 'auto',
                            top: isPos ? 'auto' : '50%'
                          }}
                        />
                         <div className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 -translate-x-1/2 bg-black text-[10px] px-1.5 py-0.5 rounded border border-slate-600 whitespace-nowrap z-10">
                           {net}
                         </div>
                      </div>
                    )
                  })}
                  {/* Placeholder for current week */}
                  <div className="flex-1 h-full relative opacity-30">
                     <div className="absolute top-1/2 left-0 right-0 h-4 -mt-2 border-l border-r border-slate-500"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Decision Area */}
          <form onSubmit={submitTurn} className="bg-slate-800 p-6 rounded-2xl border border-slate-600 shadow-lg mt-8">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Place Order to Upstream Supplier
            </label>
            <div className="flex gap-2">
              <input 
                type="number" 
                min="0"
                autoFocus
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                placeholder="Qty"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-2xl font-mono text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button 
                type="submit"
                disabled={!orderInput}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-6 py-3 rounded-lg transition-colors flex items-center"
              >
                Send <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Note: This order will take {CONFIG.orderDelay} week(s) to reach them.
            </p>
          </form>

        </div>
      </div>
    );
  }

  if (gameState === 'SUMMARY') {
    const weekData = history.filter(h => h.week === currentWeek);
    const totalWeekCost = weekData.reduce((acc, curr) => acc + curr.cost, 0);

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-6 text-center">Week {currentWeek} Summary</h2>
          
          <div className="overflow-x-auto bg-slate-800 rounded-xl border border-slate-700 mb-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-950/50">
                  <th className="p-4 text-slate-400 font-medium">Role</th>
                  <th className="p-4 text-slate-400 font-medium text-right">Inventory</th>
                  <th className="p-4 text-slate-400 font-medium text-right">Backlog</th>
                  <th className="p-4 text-slate-400 font-medium text-right">Ordered</th>
                  <th className="p-4 text-slate-400 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map(role => {
                  const data = weekData.find(d => d.roleId === role.id);
                  return (
                    <tr key={role.id} className="border-b border-slate-700 last:border-0 hover:bg-slate-700/30">
                      <td className={`p-4 font-bold ${role.color}`}>{role.label}</td>
                      <td className="p-4 text-right font-mono">{data.inventory}</td>
                      <td className="p-4 text-right font-mono text-red-400">{data.backlog > 0 ? data.backlog : '-'}</td>
                      <td className="p-4 text-right font-mono">{data.orderPlaced}</td>
                      <td className="p-4 text-right font-mono text-amber-400">${data.cost.toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-950/30 font-bold">
                  <td className="p-4" colSpan="4">Total Team Cost</td>
                  <td className="p-4 text-right text-amber-500">${totalWeekCost.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-center">
            <button 
              onClick={startNextWeek}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center gap-2 transform transition-all hover:scale-105"
            >
              {currentWeek === CONFIG.totalWeeks ? 'Finish Simulation' : 'Start Next Week'} <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'GAME_OVER') {
    const totalCost = history.reduce((acc, curr) => acc + (curr.week > 0 ? curr.cost : 0), 0);
    
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold text-white mb-4">Simulation Complete</h1>
            <div className="inline-block bg-slate-800 border border-amber-500/50 rounded-2xl p-6">
              <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Total Supply Chain Cost</p>
              <p className="text-6xl font-mono font-bold text-amber-500">${totalCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Main Bullwhip Reveal */}
          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="text-red-500" /> The Bullwhip Effect Revealed
            </h2>
            <p className="text-slate-300 mb-6 leading-relaxed">
              The "Consumer" only changed their order once! Demand was <strong>4</strong> units/week, 
              then jumped to <strong>8</strong> units/week at Week 5. That's it.
              <br/><br/>
              Compare that small change to the panic visible in the Manufacturer's orders below:
            </p>

            <div className="h-48 flex items-end justify-between gap-1 mt-4 px-4 pb-4 border-b border-slate-600 relative">
               {/* Simple CSS Bar Chart for Manufacturer Orders vs Consumer Demand */}
               {Array.from({length: 20}, (_, i) => i + 1).map(w => {
                 const manOrder = getHistoryEntry(w, 'manufacturer')?.orderPlaced || 0;
                 const consDemand = getConsumerDemand(w);
                 const hMan = Math.min(manOrder * 4, 100); 
                 const hCons = Math.min(consDemand * 4, 100);

                 return (
                   <div key={w} className="flex-1 flex flex-col justify-end gap-1 group relative">
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-xs p-2 rounded whitespace-nowrap z-10 pointer-events-none border border-slate-700">
                        W{w}: Cons {consDemand}, Man {manOrder}
                      </div>
                      <div style={{height: `${hMan}%`}} className="w-full bg-emerald-500/80 rounded-t-sm transition-all hover:bg-emerald-400"></div>
                      <div style={{bottom: `${hCons}%`}} className="absolute w-full h-1 bg-white shadow-[0_0_10px_white]"></div>
                   </div>
                 )
               })}
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2 px-1">
               <span>Week 1</span>
               <span>Week 10</span>
               <span>Week 20</span>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm">
               <div className="flex items-center gap-2">
                 <div className="w-4 h-1 bg-white"></div> <span>Consumer Demand</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-4 h-4 bg-emerald-500/80 rounded-sm"></div> <span>Manufacturer Orders</span>
               </div>
            </div>
          </div>

          {/* Detailed Player Breakdown */}
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-300">Detailed Player Analysis</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-12">
            {ROLES.map(role => (
              <div key={role.id} className={`bg-slate-800 rounded-xl border border-slate-700 p-6 ${role.border}`}>
                <h3 className={`font-bold text-xl mb-6 flex items-center gap-2 ${role.color}`}>
                   <span className={`w-3 h-3 rounded-full ${role.bg.replace('/20', '')}`}></span>
                   {role.label}
                </h3>
                
                {/* Orders Chart */}
                <div className="mb-8">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-bold">Orders Placed</p>
                    <p className="text-xs text-slate-500">Max Scale: 20+</p>
                  </div>
                  <div className="h-32 flex items-end justify-between gap-1 border-b border-slate-600 pb-px">
                    {Array.from({length: 20}, (_, i) => i + 1).map(w => {
                      const entry = getHistoryEntry(w, role.id);
                      const val = entry ? entry.orderPlaced : 0;
                      // Dynamic scaling to look good even if orders are small
                      const height = Math.min(val * 4, 100); 
                      return (
                         <div key={w} className="flex-1 bg-amber-500/80 hover:bg-amber-400 relative group rounded-t-sm transition-colors">
                            <div style={{height: `${height}%`}} className="w-full bottom-0 absolute bg-amber-500 rounded-t-sm"></div>
                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-600 text-[10px] px-2 py-1 rounded z-10 pointer-events-none whitespace-nowrap">
                              Week {w}: Ordered {val}
                            </div>
                         </div>
                      );
                    })}
                  </div>
                </div>

                {/* Inventory/Backlog Chart */}
                <div>
                   <div className="flex justify-between items-end mb-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-bold">Net Stock Position</p>
                    <div className="flex gap-3 text-xs">
                        <span className="text-emerald-400">Inventory (+)</span>
                        <span className="text-red-400">Backlog (-)</span>
                    </div>
                   </div>
                   
                   {/* Center line based chart */}
                   <div className="h-32 relative border-t border-b border-slate-700 bg-slate-900/30">
                      {/* Zero Line */}
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-500/50 z-10"></div>
                      
                      <div className="absolute inset-0 flex items-center justify-between gap-1 px-1">
                        {Array.from({length: 20}, (_, i) => i + 1).map(w => {
                          const entry = getHistoryEntry(w, role.id);
                          const inv = entry ? entry.inventory : 0;
                          const backlog = entry ? entry.backlog : 0;
                          const net = inv - backlog;
                          
                          // Scale logic: clamp at +/- 30 for visualization
                          const MAX_SCALE = 30;
                          const heightPct = Math.min((Math.abs(net) / MAX_SCALE) * 50, 50); 
                          const isPositive = net >= 0;
                          
                          return (
                            <div key={w} className="flex-1 h-full relative group">
                                <div 
                                  style={{
                                    height: `${Math.max(heightPct, 1)}%`, // Ensure at least 1% visibility
                                    bottom: isPositive ? '50%' : 'auto',
                                    top: isPositive ? 'auto' : '50%'
                                  }} 
                                  className={`absolute w-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'} rounded-sm transition-opacity hover:opacity-80`}
                                ></div>
                                {/* Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-600 text-[10px] px-2 py-1 rounded z-20 pointer-events-none whitespace-nowrap shadow-xl">
                                  Week {w}: {isPositive ? `Inv ${inv}` : `Backlog ${backlog}`}
                                </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                </div>

              </div>
            ))}
          </div>

          <div className="text-center pb-12">
            <button 
              onClick={handleStartGame}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center gap-2 mx-auto transition-all hover:scale-105"
            >
              <History className="w-5 h-5" /> Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}