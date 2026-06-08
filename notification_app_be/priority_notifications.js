const axios = require('axios');

const WEIGHTS = {
  'Placement': 3,
  'Result': 2,
  'Event': 1
};

const SAMPLE_NOTIFICATIONS = [
  {
    ID: 'd146095a-0d86-4a34-9e69-3900a14576bc',
    Type: 'Result',
    Message: 'mid-sem results out',
    Timestamp: '2026-04-22 17:51:30'
  }
];

function calculateScore(notification) {
  const weight = WEIGHTS[notification.Type] || 0;
  const timestamp = new Date(notification.Timestamp).getTime();
  return weight * 1000000 + timestamp;
}


class MinHeap {
  constructor(size) {
    this.size = size;
    this.heap = [];
  }

  getParent(i) {
    return Math.floor((i - 1) / 2);
  }

  getLeft(i) {
    return 2 * i + 1;
  }

  getRight(i) {
    return 2 * i + 2;
  }

  swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  insert(item) {
    if (this.heap.length < this.size) {
      this.heap.push(item);
      this.bubbleUp(this.heap.length - 1);
    } else if (item.score > this.heap[0].score) {
      this.heap[0] = item;
      this.bubbleDown(0);
    }
  }

  bubbleUp(i) {
    while (i > 0 && this.heap[i].score < this.heap[this.getParent(i)].score) {
      this.swap(i, this.getParent(i));
      i = this.getParent(i);
    }
  }

  bubbleDown(i) {
    while (true) {
      let smallest = i;
      const left = this.getLeft(i);
      const right = this.getRight(i);

      if (left < this.heap.length && this.heap[left].score < this.heap[smallest].score) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].score < this.heap[smallest].score) {
        smallest = right;
      }

      if (smallest !== i) {
        this.swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  getTop() {
    return this.heap.sort((a, b) => b.score - a.score);
  }
}

async function fetchNotifications() {
  try {
    console.log('Fetching notifications from API...');
    const response = await axios.get('http://4.224.186.213/evaluation-service/notifications', {
      timeout: 5000,
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJ2ZWRjaGFuZHJha2FyMTc2NEBnbWFpbC5jb20iLCJleHAiOjE3ODA5MDEzNzgsImlhdCI6MTc4MDkwMDQ3OCwiaXNzIjoiQWZmb3JkIE1lZGljYWwgVGVjaG5vbG9naWVzIFByaXZhdGUgTGltaXRlZCIsImp0aSI6IjIwMzczOGYyLTg0ZjItNDk0YS05NGU5LTFiZjRkN2QxMTVmMCIsImxvY2FsZSI6ImVuLUlOIiwibmFtZSI6InZlZGFuc2ggY2hhbmRyYWthciIsInN1YiI6IjNmNTE0MGE0LTZiMjAtNGQ2OS1iMTcxLTc5ZGJmNzA1YmRiYSJ9LCJlbWFpbCI6InZlZGNoYW5kcmFrYXIxNzY0QGdtYWlsLmNvbSIsIm5hbWUiOiJ2ZWRhbnNoIGNoYW5kcmFrYXIiLCJyb2xsTm8iOiIzMjM1IiwiYWNjZXNzQ29kZSI6ImFHQlRKWiIsImNsaWVudElEIjoiM2Y1MTQwYTQtNmIyMC00ZDY5LWIxNzEtNzlkYmY3MDViZGJhIiwiY2xpZW50U2VjcmV0IjoiTVBTbk5kWHhrWU5uc0RKWCJ9.QP5jxbzb2UDyZaP2WFuSvG4izqe4MwvGWyTr6ASxPdA'
      }
    });
    return response.data.notifications;
  } catch (error) {
    console.log('API fetch failed (likely due to missing token). Using sample data for demonstration...\n');
    return SAMPLE_NOTIFICATIONS;
  }
}

async function getTopPriorityNotifications(n = 10) {
  const notifications = await fetchNotifications();

  const heap = new MinHeap(n);

  for (const notif of notifications) {
    const score = calculateScore(notif);
    heap.insert({ ...notif, score });
  }

  return heap.getTop();
}


async function displayTopNotifications() {
  const topNotifications = await getTopPriorityNotifications(10);

  console.log('--- TOP 10 PRIORITY NOTIFICATIONS ---');
  topNotifications.forEach((notif, index) => {
    console.log(`${index + 1}. [${notif.Type}] ${notif.Message} (${notif.Timestamp})`);
  });
}

displayTopNotifications().catch(console.error);
