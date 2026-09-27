// Read the Google Apps Script URL from the .env file
export const GOOGLE_APPS_SCRIPT_BASE_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL;

const MOCK_DATA = [
  { id: '1', date: '2023-10-15', customer: 'Alice Smith', email: 'alice@example.com', category: 'Shipping', issue: 'Package hasn\'t arrived after 5 days.', status: 'pending' },
  { id: '2', date: '2023-10-14', customer: 'Bob Jones', email: 'bob@example.com', category: 'Product Quality', issue: 'The paint was slightly separated when opened.', status: 'solved' },
  { id: '3', date: '2023-10-16', customer: 'Charlie Davis', email: 'charlie@example.com', category: 'Billing', issue: 'I was charged twice for the same order.', status: 'pending' },
  { id: '4', date: '2023-10-16', customer: 'Diana Ross', email: 'diana@example.com', category: 'Support', issue: 'Cannot log into my wholesale account.', status: 'solved' },
  { id: '5', date: '2023-10-17', customer: 'Evan Wright', email: 'evan@example.com', category: 'Shipping', issue: 'Wrong item was delivered to my address.', status: 'pending' },
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchComplaints = async (username, password) => {
  if (GOOGLE_APPS_SCRIPT_BASE_URL && username && password) {
    try {
      const response = await fetch(`${GOOGLE_APPS_SCRIPT_BASE_URL}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching from Google Sheets:", error);
      // Fallback below
    }
  }

  await delay(800);
  const stored = localStorage.getItem('complaintsData');
  if (stored) {
    return JSON.parse(stored);
  }
  localStorage.setItem('complaintsData', JSON.stringify(MOCK_DATA));
  return MOCK_DATA;
};

export const updateComplaintStatus = async (id, newStatus, username, password) => {
  if (GOOGLE_APPS_SCRIPT_BASE_URL && username && password) {
    try {
      await fetch(`${GOOGLE_APPS_SCRIPT_BASE_URL}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ id, status: newStatus })
      });
    } catch (error) {
      console.error("Error updating Google Sheets:", error);
    }
  } else {
    await delay(500);
  }
  
  const stored = localStorage.getItem('complaintsData');
  if (stored) {
    const data = JSON.parse(stored);
    const updated = data.map(c => c.id === id ? { ...c, status: newStatus } : c);
    localStorage.setItem('complaintsData', JSON.stringify(updated));
    return updated;
  }
};

export const deleteComplaint = async (id, username, password) => {
  if (GOOGLE_APPS_SCRIPT_BASE_URL && username && password) {
    try {
      await fetch(`${GOOGLE_APPS_SCRIPT_BASE_URL}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ id, action: 'delete' })
      });
    } catch (error) {
      console.error("Error deleting from Google Sheets:", error);
    }
  } else {
    await delay(500);
  }
  
  const stored = localStorage.getItem('complaintsData');
  if (stored) {
    const data = JSON.parse(stored);
    const updated = data.filter(c => c.id !== id);
    localStorage.setItem('complaintsData', JSON.stringify(updated));
    return updated;
  }
};
