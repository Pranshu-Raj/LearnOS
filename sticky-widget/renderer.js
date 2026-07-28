document.getElementById('close-btn').addEventListener('click', () => {
    window.api.closeApp();
});

const contentDiv = document.getElementById('content');
let timerInterval = null;

async function render() {
    contentDiv.innerHTML = '<p>Loading...</p>';
    
    const topics = await window.api.getTopics();
    const pendingTopics = topics.filter(t => t.fm.status !== 'done');
    
    if (pendingTopics.length === 0) {
        contentDiv.innerHTML = `<h2>All Done! 🎉</h2><p>You have finished all your topics.</p>`;
        return;
    }

    // Grab the first incomplete topic for the sticky note focus
    const currentTopic = pendingTopics[0];
    
    contentDiv.innerHTML = `
        <h2>Current Focus</h2>
        <h4>${currentTopic.fm.topic}</h4>
        <br/>
        <div class="topic-item" id="start-focus-btn">
            ▶️ Start Pomodoro (${currentTopic.fm.estimated_minutes || 25}m)
        </div>
        <div class="topic-item" id="mark-done-btn">
            ✅ Mark as Done
        </div>
    `;

    document.getElementById('start-focus-btn').addEventListener('click', () => {
        renderTimer(currentTopic);
    });

    document.getElementById('mark-done-btn').addEventListener('click', async () => {
        currentTopic.fm.status = 'done';
        await window.api.updateTopic(currentTopic.filename, currentTopic.fm);
        render(); // fetch next topic
    });
}

function renderTimer(topic) {
    const estimatedMinutes = topic.fm.estimated_minutes || 25;
    let secondsRemaining = estimatedMinutes * 60;
    let isRunning = true;

    contentDiv.innerHTML = `
        <h2>Focusing...</h2>
        <h4>${topic.fm.topic}</h4>
        <div class="timer-display" id="timer-text">${formatTime(secondsRemaining)}</div>
        <div class="btn-group">
            <button class="primary" id="play-pause-btn">Pause</button>
            <button class="secondary" id="stop-btn">Stop & Log</button>
        </div>
    `;

    const timerText = document.getElementById('timer-text');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stopBtn = document.getElementById('stop-btn');

    const tick = () => {
        if (secondsRemaining > 0) {
            secondsRemaining--;
            timerText.innerText = formatTime(secondsRemaining);
        }
    };

    timerInterval = setInterval(tick, 1000);

    playPauseBtn.addEventListener('click', () => {
        if (isRunning) {
            isRunning = false;
            playPauseBtn.innerText = "Resume";
            clearInterval(timerInterval);
        } else {
            isRunning = true;
            playPauseBtn.innerText = "Pause";
            timerInterval = setInterval(tick, 1000);
        }
    });

    stopBtn.addEventListener('click', async () => {
        clearInterval(timerInterval);
        
        const elapsedSeconds = (estimatedMinutes * 60) - secondsRemaining;
        const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
        
        const input = window.prompt(`Session ended! How many minutes did you actually spend?`, elapsedMinutes.toString());
        
        if (input !== null) {
            const loggedMinutes = parseInt(input) || elapsedMinutes;
            topic.fm.actual_minutes = (topic.fm.actual_minutes || 0) + loggedMinutes;
            await window.api.updateTopic(topic.filename, topic.fm);
        }
        render(); // Return to main view
    });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Initial render
render();
