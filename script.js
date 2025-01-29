const API_BASE_URL = 'https://api.ftcscout.org/rest/v1';

const DOM = {
    mainContent: document.querySelector('.main-content'),
    landingHeader: document.querySelector('.landing-header'),
    teamNumberInput: document.getElementById('teamNumber'),
    seasonSelector: document.getElementById('seasonSelector'),
    statsContainer: document.getElementById('stats-container'),
    analyticsContainer: document.getElementById('analytics-container'),
    teamBasicInfo: document.getElementById('teamBasicInfo'),
    teamStats: document.getElementById('teamStats'),
    charts: {
        scoreProgression: document.getElementById('scoreProgressionChart'),
        phaseBreakdown: document.getElementById('phaseBreakdownChart'),
        performanceRadar: document.getElementById('performanceRadarChart'),
        consistency: document.getElementById('consistencyChart')
    }
};

const chartInstances = {
    matchHistory: null,
    phaseBreakdown: null,
    winLoss: null,
    performanceTrends: null
};

const apiCache = new Map();
const getCachedData = async (url, ttl = 300000) => {
    const cached = apiCache.get(url);
    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    apiCache.set(url, { data, timestamp: Date.now() });
    return data;
};

const chartConfig = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
        duration: 750,
        easing: 'easeInOutQuart'
    },
    plugins: {
        legend: {
            labels: { color: '#ffffff' }
        }
    },
    scales: {
        y: {
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#ffffff' }
        },
        x: {
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#ffffff' }
        }
    }
};

const smoothUpdate = (callback) => {
    requestAnimationFrame(() => {
        requestAnimationFrame(callback);
    });
};

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function destroyCharts() {
    [chartInstances.matchHistory, chartInstances.phaseBreakdown, chartInstances.winLoss, chartInstances.performanceTrends].forEach(chart => {
        if (chart) {
            chart.destroy();
            chart = null;
        }
    });
}

async function searchTeam() {
    const teamNumber = document.getElementById('teamNumber').value;
    if (!teamNumber) return;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.classList.add('visible');

    const landingHeader = document.querySelector('.landing-header');
    if (landingHeader) landingHeader.classList.add('searched');

    try {
        const teamResponse = await fetch(`${API_BASE_URL}/teams/${teamNumber}`);
        const basicTeamData = await teamResponse.json();
        
        createSeasonSelector(basicTeamData.rookieYear || 2024);
        
        const selectorContainer = document.getElementById('seasonSelectorContainer');
        if (selectorContainer) {
            selectorContainer.classList.remove('hidden');
            selectorContainer.classList.add('visible');
        }
        
        const selectedYear = document.getElementById('seasonSelector')?.value || 2024;
        const teamData = await fetchTeamData(teamNumber, selectedYear);
        const matchData = await fetchTeamMatches(teamNumber, selectedYear);

        displayTeamInfo(teamData, matchData);
        displayMatchData(matchData);
    } catch (error) {
        console.error('Error:', error);
    }
}

function createSeasonSelector(rookieYear) {
    const seasonSelector = document.getElementById('seasonSelector');
    if (!seasonSelector) return;

    const currentYear = 2024;
    seasonSelector.innerHTML = '';
    
    for (let year = currentYear; year >= rookieYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        seasonSelector.appendChild(option);
    }
    
    seasonSelector.onchange = async () => {
        const teamNumber = document.getElementById('teamNumber')?.value;
        if (!teamNumber) return;
        
        const selectedYear = seasonSelector.value;
        const teamData = await fetchTeamData(teamNumber, selectedYear);
        const matchData = await fetchTeamMatches(teamNumber, selectedYear);
        
        displayTeamInfo(teamData, matchData);
        displayMatchData(matchData);
    };
}

function displayMatchData(matchData) {
    const statsContainer = document.getElementById('stats-container');
    statsContainer.classList.remove('hidden');
    statsContainer.innerHTML = '<h2>Event Statistics</h2>';

    if (!matchData || Object.keys(matchData).length === 0) {
        statsContainer.innerHTML += '<p>No match data available</p>';
        return;
    }

    Object.entries(matchData).forEach(([eventCode, eventData]) => {
        const eventSection = document.createElement('div');
        eventSection.className = 'event-section';
        
        const stats = eventData.details.stats;
        eventSection.innerHTML = `
            <div class="event-header">
                <h2>${eventCode}</h2>
                <div class="event-stats">
                    <p>Rank: ${stats.rank}</p>
                    <p>Record: ${stats.wins}-${stats.losses}-${stats.ties}</p>
                    <p>RP: ${stats.rp.toFixed(2)}</p>
                    <p>TB1: ${stats.tb1.toFixed(1)}</p>
                    <p>TB2: ${stats.tb2.toFixed(1)}</p>
                </div>
            </div>
            <div class="matches-container">
                ${eventData.matches.map(match => {
                    const redScore = match.redScore?.totalPointsNp || match.redScore?.totalPoints || 0;
                    const blueScore = match.blueScore?.totalPointsNp || match.blueScore?.totalPoints || 0;
                    const autoPoints = match[`${match.alliance.toLowerCase()}Score`]?.autoPoints || 0;
                    const dcPoints = match[`${match.alliance.toLowerCase()}Score`]?.dcPoints || 0;
                    
                    return `
                        <div class="match-card ${match.alliance.toLowerCase()}-alliance">
                            <div class="match-header">
                                <span class="station">${match.alliance} ${match.station}</span>
                            </div>
                            <div class="match-scores">
                                <div class="score red-score">
                                    <span class="label">Red:</span>
                                    <span class="value">${redScore}</span>
                                </div>
                                <div class="score blue-score">
                                    <span class="label">Blue:</span>
                                    <span class="value">${blueScore}</span>
                                </div>
                            </div>
                            <div class="match-details">
                                <div class="auto-points">
                                    <p>Auto: ${autoPoints}</p>
                                </div>
                                <div class="teleop-points">
                                    <p>TeleOp: ${dcPoints}</p>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        statsContainer.appendChild(eventSection);
    });

    createAnalytics(matchData);
}

async function fetchTeamData(teamNumber, year) {
    try {
        console.log('Fetching data for team:', teamNumber);
        
        const teamResponse = await fetch(`${API_BASE_URL}/teams/${teamNumber}`);
        const teamData = await teamResponse.json();
        console.log('Team Data:', teamData);

        const eventsResponse = await fetch(`${API_BASE_URL}/teams/${teamNumber}/events/${year}`);
        const eventsData = await eventsResponse.json();
        console.log('Events Data:', eventsData);
        
        let eventStats = null;
        if (eventsData && eventsData.length > 0) {
            const sortedEvents = eventsData.sort((a, b) => 
                new Date(b.startDate) - new Date(a.startDate)
            );
            eventStats = sortedEvents[0].stats;
            console.log('Event Stats:', eventStats);
        }
        
        const statsUrl = `${API_BASE_URL}/teams/${teamNumber}/quick-stats?season=${year}`;
        console.log('Fetching quick stats from:', statsUrl);
        const statsResponse = await fetch(statsUrl);
        const quickStats = await statsResponse.json();
        console.log('Quick Stats:', quickStats);

        const stats = {
            ...quickStats,
            ...eventStats,
            events: eventsData
        };
        console.log('Combined Stats:', stats);
        
        return {
            ...teamData,
            stats: stats
        };
    } catch (error) {
        console.error('Error fetching team data:', error);
        throw error;
    }
}

async function fetchTeamMatches(teamNumber, year) {
    try {
        const eventsUrl = `${API_BASE_URL}/teams/${teamNumber}/events/${year}`;
        console.log('Fetching events from:', eventsUrl);
        const eventsResponse = await fetch(eventsUrl);
        if (!eventsResponse.ok) throw new Error('Events data not found');
        const eventsData = await eventsResponse.json();
        console.log('Events data:', eventsData);

        const eventMatches = {};
        
        for (const event of eventsData) {
            try {
                const eventCode = event.eventCode;
                
                const eventMatchesUrl = `${API_BASE_URL}/events/${year}/${eventCode}/matches`;
                console.log(`Fetching all matches for event ${eventCode} from:`, eventMatchesUrl);
                const eventMatchesResponse = await fetch(eventMatchesUrl);
                if (!eventMatchesResponse.ok) continue;
                const allEventMatches = await eventMatchesResponse.json();
                console.log(`All matches for event ${eventCode}:`, allEventMatches);

                const teamMatches = allEventMatches.filter(match => {
                    return match.teams.some(team => team.teamNumber === parseInt(teamNumber));
                });

                if (teamMatches.length > 0) {
                    eventMatches[eventCode] = {
                        details: {
                            name: event.name,
                            startDate: event.startDate,
                            endDate: event.endDate,
                            location: event.location,
                            stats: event.stats || {
                                wins: 0,
                                losses: 0,
                                ties: 0,
                                rp: 0,
                                rank: 0,
                                tb1: 0,
                                tb2: 0
                            }
                        },
                        matches: teamMatches.map(match => {
                            const ourTeamInfo = match.teams.find(team => 
                                team.teamNumber === parseInt(teamNumber)
                            );
                            
                            return {
                                matchNumber: match.id,
                                matchType: match.tournamentLevel,
                                alliance: ourTeamInfo.alliance,
                                station: ourTeamInfo.station,
                                redScore: match.scores.red,
                                blueScore: match.scores.blue,
                                surrogate: ourTeamInfo.surrogate,
                                noShow: ourTeamInfo.noShow,
                                dq: ourTeamInfo.dq,
                                teams: {
                                    red: match.teams.filter(t => t.alliance === 'Red'),
                                    blue: match.teams.filter(t => t.alliance === 'Blue')
                                }
                            };
                        })
                    };
                }
            } catch (error) {
                console.error(`Error fetching matches for event ${event.eventCode}:`, error);
            }
        }

        for (const eventCode in eventMatches) {
            eventMatches[eventCode].matches.sort((a, b) => {
                const typeOrder = { 'Quals': 0, 'Semis': 1, 'Finals': 2 };
                if (a.matchType !== b.matchType) {
                    return typeOrder[a.matchType] - typeOrder[b.matchType];
                }
                return a.matchNumber - b.matchNumber;
            });
        }

        console.log('Final processed event matches:', eventMatches);
        return eventMatches;
    } catch (error) {
        console.error('Error fetching match data:', error);
        return {};
    }
}

function determineResult(match) {
    const redScore = match.redScore?.totalPointsNp || match.redScore?.totalPoints || 0;
    const blueScore = match.blueScore?.totalPointsNp || match.blueScore?.totalPoints || 0;
    
    if (match.alliance === 'RED') {
        if (redScore > blueScore) return 'Won';
        if (redScore < blueScore) return 'Lost';
        return 'Tie';
    }
    if (match.alliance === 'BLUE') {
        if (blueScore > redScore) return 'Won';
        if (blueScore < redScore) return 'Lost';
        return 'Tie';
    }
    
    return 'N/A';
}

function displayTeamInfo(teamData, matchData) {
    const record = { wins: 0, losses: 0, ties: 0 };
    
    if (matchData) {
        Object.values(matchData).forEach(eventData => {
            if (eventData.matches) {
                eventData.matches.forEach(match => {
                    const redScore = match.redScore?.totalPointsNp || match.redScore?.totalPoints || 0;
                    const blueScore = match.blueScore?.totalPointsNp || match.blueScore?.totalPoints || 0;
                    
                    if (match.alliance?.toLowerCase() === 'red') {
                        if (redScore > blueScore) record.wins++;
                        else if (redScore < blueScore) record.losses++;
                        else record.ties++;
                    } else if (match.alliance?.toLowerCase() === 'blue') {
                        if (blueScore > redScore) record.wins++;
                        else if (blueScore < redScore) record.losses++;
                        else record.ties++;
                    }
                });
            }
        });
    }

    const basicInfoDiv = document.getElementById('teamBasicInfo');
    basicInfoDiv.innerHTML = `
        <div class="team-header">
            <div class="team-basic-info">
                <h3>${teamData.number} - ${teamData.name || 'Unknown Team'}</h3>
                <p><strong>Location:</strong> ${[
                    teamData.city,
                    teamData.state,
                    teamData.country
                ].filter(Boolean).join(', ') || 'Location Unknown'}</p>
                <p><strong>Rookie Year:</strong> ${teamData.rookieYear || 'Unknown'}</p>
            </div>
            <div class="team-record">
                <span class="record-label">Overall Record</span>
                <span class="record-numbers">${record.wins}W - ${record.losses}L - ${record.ties}T</span>
            </div>
        </div>
    `;

    const statsDiv = document.getElementById('teamStats');
    
    if (teamData.stats) {
        const formatValue = (value) => {
            if (typeof value === 'number') return value.toFixed(2);
            return '0.00';
        };

        const stats = teamData.stats;
        
        statsDiv.innerHTML = `
            <h3>Team Statistics (2024 Season)</h3>
            
            <div class="stats-grid">
                <div class="stats-section">
                    <h4>Season Rankings</h4>
                    <table class="stats-table">
                        <tr>
                            <th>Category</th>
                            <th>Value</th>
                            <th>Rank</th>
                        </tr>
                        <tr>
                            <td>Auto</td>
                            <td>${formatValue(stats.auto?.value)}</td>
                            <td>${stats.auto?.rank || 'N/A'} of ${stats.count || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td>Driver Control</td>
                            <td>${formatValue(stats.dc?.value)}</td>
                            <td>${stats.dc?.rank || 'N/A'} of ${stats.count || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td>Endgame</td>
                            <td>${formatValue(stats.eg?.value)}</td>
                            <td>${stats.eg?.rank || 'N/A'} of ${stats.count || 'N/A'}</td>
                        </tr>
                    </table>
                </div>

                <div class="stats-section">
                    <h4>Average Match Breakdown</h4>
                    <table class="stats-table">
                        <tr>
                            <th>Phase</th>
                            <th>Avg</th>
                            <th>Max</th>
                        </tr>
                        <tr>
                            <td>Auto</td>
                            <td>${formatValue(stats.avg?.autoPoints)}</td>
                            <td>${stats.max?.autoPoints || '0'}</td>
                        </tr>
                        <tr>
                            <td>Driver Control</td>
                            <td>${formatValue(stats.avg?.dcPoints)}</td>
                            <td>${stats.max?.dcPoints || '0'}</td>
                        </tr>
                        <tr>
                            <td>Total (No Penalties)</td>
                            <td>${formatValue(stats.avg?.totalPointsNp)}</td>
                            <td>${stats.max?.totalPointsNp || '0'}</td>
                        </tr>
                        <tr>
                            <td>Total (With Penalties)</td>
                            <td>${formatValue(stats.avg?.totalPoints)}</td>
                            <td>${stats.max?.totalPoints || '0'}</td>
                        </tr>
                    </table>
                </div>
            </div>
        `;
    } else {
        statsDiv.innerHTML = `
            <h3>Team Statistics</h3>
            <p>No statistics available for this team in the current season.</p>
        `;
    }
}

function createMatchCard(match) {
    const result = determineResult(match);
    const matchTypeDisplay = match.matchType === 'QUALIFICATION' ? 'Q' : match.matchType === 'SEMIFINAL' ? 'SF' : match.matchType === 'FINAL' ? 'F' : match.matchType;
    
    return `
        <div class="match-card ${match.alliance.toLowerCase()} animate-fade-in">
            <div class="match-header">
                <h5>${matchTypeDisplay}-${match.matchNumber}</h5>
            </div>
            <div class="match-details">
                <div class="match-info">
                    <div class="alliance-info">
                        <span class="alliance ${match.alliance.toLowerCase()}">${match.alliance}</span>
                        <span class="station">Station ${match.station}</span>
                    </div>
                    <div class="score-display">
                        <div class="red-score ${match.alliance === 'RED' ? 'highlighted' : ''}">
                            ${match.redScore !== undefined ? match.redScore : 'TBD'}
                        </div>
                        <div class="score-divider">-</div>
                        <div class="blue-score ${match.alliance === 'BLUE' ? 'highlighted' : ''}">
                            ${match.blueScore !== undefined ? match.blueScore : 'TBD'}
                        </div>
                    </div>
                    <div class="match-result ${result.toLowerCase()}">
                        ${result}
                    </div>
                </div>
                <div class="teams-display">
                    <div class="red-alliance">
                        ${match.teams.red.map(team => 
                            `<div class="team-number">${team.teamNumber}</div>`
                        ).join('')}
                    </div>
                    <div class="blue-alliance">
                        ${match.teams.blue.map(team => 
                            `<div class="team-number">${team.teamNumber}</div>`
                        ).join('')}
                    </div>
                </div>
                <div class="match-status">
                    ${match.surrogate ? '<span class="status surrogate">Surrogate</span>' : ''}
                    ${match.noShow ? '<span class="status no-show">No Show</span>' : ''}
                    ${match.dq ? '<span class="status dq">Disqualified</span>' : ''}
                </div>
            </div>
        </div>
    `;
}

function calculateEventStats(matches) {
    return matches.reduce((stats, match) => {
        const result = determineResult(match);
        if (result === 'Won') stats.wins++;
        else if (result === 'Lost') stats.losses++;
        else if (result === 'Tie') stats.ties++;
        return stats;
    }, { wins: 0, losses: 0, ties: 0 });
}

function toggleEventMatches(eventCode) {
    const matchesContainer = document.getElementById(`matches-${eventCode}`);
    const expandIcon = matchesContainer.previousElementSibling.querySelector('.expand-icon');
    matchesContainer.classList.toggle('hidden');
    expandIcon.textContent = matchesContainer.classList.contains('hidden') ? '▼' : '▲';
}

function createAnalytics(matchData) {
    document.getElementById('analytics-container').classList.remove('hidden');
    
    const allMatches = Object.values(matchData).flatMap(event => event.matches);
    
    if (chartInstances.matchHistory) chartInstances.matchHistory.destroy();
    if (chartInstances.phaseBreakdown) chartInstances.phaseBreakdown.destroy();
    if (chartInstances.winLoss) chartInstances.winLoss.destroy();
    if (chartInstances.performanceTrends) chartInstances.performanceTrends.destroy();
    
    chartInstances.matchHistory = createMatchHistoryChart(allMatches);
    chartInstances.phaseBreakdown = createScoringBreakdownChart(allMatches);
    chartInstances.winLoss = createWinLossChart(allMatches);
    chartInstances.performanceTrends = createPerformanceTrendsChart(allMatches);
}

function createMatchHistoryChart(matches) {
    const ctx = document.getElementById('scoreProgressionChart').getContext('2d');
    
    const matchData = matches.map((match, index) => {
        const alliance = match.alliance.toLowerCase();
        const score = match[`${alliance}Score`];
        return {
            auto: score?.autoPoints || 0,
            teleop: score?.dcPoints || 0,
            total: score?.totalPointsNp || 0,
            matchNumber: index + 1
        };
    });

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: matchData.map(m => `Match ${m.matchNumber}`),
            datasets: [
                {
                    label: 'Auto',
                    data: matchData.map(m => m.auto),
                    backgroundColor: 'rgba(255, 206, 86, 0.8)',
                    stack: 'Stack 0',
                },
                {
                    label: 'TeleOp',
                    data: matchData.map(m => m.teleop),
                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                    stack: 'Stack 0',
                },
                {
                    label: 'Match Average',
                    data: matchData.map(() => {
                        const avg = matchData.reduce((sum, m) => sum + m.total, 0) / matchData.length;
                        return avg;
                    }),
                    type: 'line',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                }
            ]
        },
        options: {
            ...chartConfig,
            plugins: {
                title: {
                    display: true,
                    text: 'Match History Breakdown',
                    color: '#ffffff',
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y || 0;
                            return `${label}: ${Math.round(value)} points`;
                        }
                    }
                }
            }
        }
    });
}

function createScoringBreakdownChart(matches) {
    const ctx = document.getElementById('phaseBreakdownChart').getContext('2d');
    
    const scoringData = matches.reduce((acc, match) => {
        const alliance = match.alliance.toLowerCase();
        const score = match[`${alliance}Score`];
        if (score) {
            acc.auto += score.autoPoints || 0;
            acc.teleop += score.dcPoints || 0;
        }
        return acc;
    }, { auto: 0, teleop: 0 });

    const total = scoringData.auto + scoringData.teleop;
    const autoPercentage = (scoringData.auto / total * 100).toFixed(1);
    const teleopPercentage = (scoringData.teleop / total * 100).toFixed(1);

    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [`Auto (${autoPercentage}%)`, `TeleOp (${teleopPercentage}%)`],
            datasets: [{
                data: [scoringData.auto, scoringData.teleop],
                backgroundColor: [
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)'
                ],
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1
            }]
        },
        options: {
            ...chartConfig,
            plugins: {
                title: {
                    display: true,
                    text: 'Scoring Phase Distribution',
                    color: '#ffffff',
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ${Math.round(value)} points`;
                        }
                    }
                }
            }
        }
    });
}

function createWinLossChart(matches) {
    const ctx = document.getElementById('performanceRadarChart').getContext('2d');
    
    const results = matches.reduce((acc, match) => {
        const redScore = match.redScore?.totalPointsNp || match.redScore?.totalPoints || 0;
        const blueScore = match.blueScore?.totalPointsNp || match.blueScore?.totalPoints || 0;
        
        if (match.alliance.toLowerCase() === 'red') {
            if (redScore > blueScore) acc.won++;
            else if (redScore < blueScore) acc.lost++;
            else acc.tie++;
        } else if (match.alliance.toLowerCase() === 'blue') {
            if (blueScore > redScore) acc.won++;
            else if (blueScore < redScore) acc.lost++;
            else acc.tie++;
        }
        
        return acc;
    }, { won: 0, lost: 0, tie: 0 });

    console.log('Match Results:', results);

    const total = matches.length;
    const winRate = total > 0 ? ((results.won / total) * 100).toFixed(1) : '0.0';

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                `Wins (${results.won})`,
                `Losses (${results.lost})`,
                `Ties (${results.tie})`
            ],
            datasets: [{
                data: [results.won, results.lost, results.tie],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 206, 86, 0.8)'
                ],
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1
            }]
        },
        options: {
            ...chartConfig,
            plugins: {
                title: {
                    display: true,
                    text: `Win/Loss Record (${winRate}% Win Rate)`,
                    color: '#ffffff',
                    font: { size: 16 }
                }
            }
        }
    });
}

function createPerformanceTrendsChart(matches) {
    const ctx = document.getElementById('consistencyChart').getContext('2d');
    
    const movingAverage = (data, windowSize) => {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - windowSize + 1);
            const window = data.slice(start, i + 1);
            const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
            result.push(avg);
        }
        return result;
    };

    const scores = matches.map(match => {
        const alliance = match.alliance.toLowerCase();
        return match[`${alliance}Score`]?.totalPointsNp || 0;
    });

    const trendLine = movingAverage(scores, 3);

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: matches.map((_, i) => `Match ${i + 1}`),
            datasets: [
                {
                    label: 'Match Score',
                    data: scores,
                    borderColor: 'rgba(75, 192, 192, 0.8)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    pointRadius: 4,
                    fill: true
                },
                {
                    label: '3-Match Average',
                    data: trendLine,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            ...chartConfig,
            plugins: {
                title: {
                    display: true,
                    text: 'Performance Trends',
                    color: '#ffffff',
                    font: { size: 16 }
                }
            }
        }
    });
}