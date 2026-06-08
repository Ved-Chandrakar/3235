const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchFromAPI(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '4.224.186.213',
      path: endpoint,
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJ2ZWRjaGFuZHJha2FyMTc2NEBnbWFpbC5jb20iLCJleHAiOjE3ODA4OTY1MjgsImlhdCI6MTc4MDg5NTYyOCwiaXNzIjoiQWZmb3JkIE1lZGljYWwgVGVjaG5vbG9naWVzIFByaXZhdGUgTGltaXRlZCIsImp0aSI6IjRhMDhiODk3LTRkMTEtNDI1ZC04NDFjLTJmNjYzNjk0YmQwMiIsImxvY2FsZSI6ImVuLUlOIiwibmFtZSI6InZlZGFuc2ggY2hhbmRyYWthciIsInN1YiI6IjNmNTE0MGE0LTZiMjAtNGQ2OS1iMTcxLTc5ZGJmNzA1YmRiYSJ9LCJlbWFpbCI6InZlZGNoYW5kcmFrYXIxNzY0QGdtYWlsLmNvbSIsIm5hbWUiOiJ2ZWRhbnNoIGNoYW5kcmFrYXIiLCJyb2xsTm8iOiIzMjM1IiwiYWNjZXNzQ29kZSI6ImFHQlRKWiIsImNsaWVudElEIjoiM2Y1MTQwYTQtNmIyMC00ZDY5LWIxNzEtNzlkYmY3MDViZGJhIiwiY2xpZW50U2VjcmV0IjoiTVBTbk5kWHhrWU5uc0RKWCJ9.mp-cP_2wOpWBGv9X-3niY338Z1ov12j5BveHXdx0nhI',
        'Content-Type': 'application/json'
      }
    };
    https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (err) { reject(err); }
      });
    }).on('error', reject).end();
  });
}

function solveKnapsack(items, capacity) {
  const n = items.length;
  const dp = Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0));
  
  for (let i = 1; i <= n; i++) {
    const duration = items[i - 1].Duration;
    const impact = items[i - 1].Impact;
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];
      if (duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - duration] + impact);
      }
    }
  }
  
  const selectedIndices = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedIndices.push(i - 1);
      w -= items[i - 1].Duration;
    }
  }
  
  const selectedTasks = selectedIndices.map(idx => items[idx]);
  const totalDuration = selectedTasks.reduce((sum, task) => sum + task.Duration, 0);
  const totalImpact = selectedTasks.reduce((sum, task) => sum + task.Impact, 0);
  
  return {
    selectedTasks,
    totalDuration,
    totalImpact,
    maxCapacity: capacity,
    efficiency: totalImpact > 0 ? (totalImpact / totalDuration).toFixed(2) : 0
  };
}
async function runScheduler() {
  try {
    console.log('Starting scheduler...\n');
    const depotsResponse = await fetchFromAPI('/evaluation-service/depots');
    const depots = depotsResponse.depots || depotsResponse;
    const vehiclesResponse = await fetchFromAPI('/evaluation-service/vehicles');
    const vehicles = vehiclesResponse.vehicles || vehiclesResponse;
    
    const results = {
      timestamp: new Date().toISOString(),
      depots: depots.map(depot => {
        const solution = solveKnapsack(vehicles, depot.MechanicHours);
        return {
          depotID: depot.ID,
          availableMechanicHours: depot.MechanicHours,
          selectedTasks: solution.selectedTasks.map(t => ({TaskID: t.TaskID, Duration: t.Duration, Impact: t.Impact})),
          summary: {
            tasksSelected: solution.selectedTasks.length,
            totalDuration: solution.totalDuration,
            totalImpact: solution.totalImpact,
            hoursUtilized: `${solution.totalDuration}/${solution.maxCapacity}`,
            utilizationRate: `${((solution.totalDuration / solution.maxCapacity) * 100).toFixed(2)}%`,
            impactEfficiency: solution.efficiency
          }
        };
      })
    };
    
    const outputDir = '../vehicle_scheduling';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, {recursive: true});
    
    fs.writeFileSync(path.join(outputDir, 'scheduling_results.json'), JSON.stringify(results, null, 2));
    
    let reportContent = `# Scheduler Report\n\n**Generated:** ${results.timestamp}\n\n`;
    results.depots.forEach(d => {
      reportContent += `## Depot ${d.depotID}\n- Hours: ${d.availableMechanicHours}\n- Tasks: ${d.summary.tasksSelected}\n- Impact: ${d.summary.totalImpact}\n- Usage: ${d.summary.hoursUtilized} (${d.summary.utilizationRate})\n\n`;
    });
    fs.writeFileSync(path.join(outputDir, 'scheduling_report.md'), reportContent);
    
    console.log('Scheduling complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runScheduler();
