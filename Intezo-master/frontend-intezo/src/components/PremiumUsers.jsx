import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_CONFIG } from '../config/api';

const ITEMS_PER_PAGE = 20;

const formatDate = value => {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getSubscriptionTiming = expiresAt => {
  if (!expiresAt) return 'No expiry date';
  const difference = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(Math.abs(difference) / 86400000);
  if (difference > 0) return `${days} day${days === 1 ? '' : 's'} remaining`;
  return `Expired ${days} day${days === 1 ? '' : 's'} ago`;
};

const PremiumUsers = () => {
  const [premiumUsers, setPremiumUsers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, expired: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPremiumUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/premium-users`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to load premium users');
      }
      setPremiumUsers(data.premiumUsers || []);
      setSummary(data.summary || { total: 0, active: 0, expired: 0 });
    } catch (fetchError) {
      setError(fetchError.message || 'Unable to load premium users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPremiumUsers();
  }, [fetchPremiumUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return premiumUsers.filter(user => {
      const matchesStatus = statusFilter === 'all' || user.premiumStatus === statusFilter;
      const matchesSearch = !normalizedSearch || [user.name, user.email, user.phone]
        .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });
  }, [premiumUsers, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const updateFilters = callback => {
    callback();
    setCurrentPage(1);
  };

  return (
    <section className="premium-users">
      <div className="premium-users-header">
        <div>
          <h2>Premium Users</h2>
          <p>All active and expired premium subscriptions.</p>
        </div>
        <button type="button" className="premium-refresh-btn" onClick={fetchPremiumUsers}>
          Refresh
        </button>
      </div>

      <div className="premium-summary-grid">
        <div className="premium-summary-card">
          <span>Total premium users</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="premium-summary-card active">
          <span>Active subscriptions</span>
          <strong>{summary.active}</strong>
        </div>
        <div className="premium-summary-card expired">
          <span>Expired subscriptions</span>
          <strong>{summary.expired}</strong>
        </div>
      </div>

      <div className="premium-users-toolbar">
        <input
          type="search"
          value={search}
          onChange={event => updateFilters(() => setSearch(event.target.value))}
          placeholder="Search name, email, or phone"
          aria-label="Search premium users"
        />
        <select
          value={statusFilter}
          onChange={event => updateFilters(() => setStatusFilter(event.target.value))}
          aria-label="Filter premium users by status"
        >
          <option value="all">All subscriptions</option>
          <option value="active">Active only</option>
          <option value="expired">Expired only</option>
        </select>
      </div>

      {loading ? (
        <div className="premium-users-state">Loading premium users...</div>
      ) : error ? (
        <div className="premium-users-state error">
          <p>{error}</p>
          <button type="button" onClick={fetchPremiumUsers}>Try again</button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="premium-users-state">No premium users match this filter.</div>
      ) : (
        <>
          <div className="premium-users-table-wrap">
            <table className="premium-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Subscription</th>
                  <th>Latest approved payment</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </td>
                    <td>{user.phone}</td>
                    <td>
                      <span className={`premium-status ${user.premiumStatus}`}>
                        {user.premiumStatus}
                      </span>
                    </td>
                    <td>
                      <strong>{formatDate(user.premiumExpiresAt)}</strong>
                      <span>{getSubscriptionTiming(user.premiumExpiresAt)}</span>
                    </td>
                    <td>{user.premiumStatus === 'active' ? 'Premium access enabled' : 'Renewal required'}</td>
                    <td>
                      {user.latestPayment ? (
                        <>
                          <strong>
                            Rs {user.latestPayment.amount} via {user.latestPayment.paymentMethod.toUpperCase()}
                          </strong>
                          <span>Approved {formatDate(user.latestPayment.reviewedAt)}</span>
                        </>
                      ) : (
                        <span>No approved payment record</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="premium-users-pagination">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PremiumUsers;
