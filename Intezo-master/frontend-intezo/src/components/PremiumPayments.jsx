import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { API_CONFIG } from '../config/api';

const PremiumPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activePaymentTab, setActivePaymentTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/premium-payments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments);
      } else {
        alert('Failed to fetch premium payments');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      alert('Error loading premium payments');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/premium-payments/${paymentId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        alert('Premium payment approved successfully');
        fetchPendingPayments();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to approve payment');
      }
    } catch (error) {
      console.error('Error approving payment:', error);
      alert('Error approving payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/premium-payments/${selectedPayment.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (response.ok) {
        alert('Premium payment rejected');
        setShowRejectDialog(false);
        setRejectionReason('');
        setSelectedPayment(null);
        fetchPendingPayments();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to reject payment');
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      alert('Error rejecting payment');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodColor = (method) => {
    const colors = {
      easypesa: '#00A651',
      jazzcash: '#FF6B35',
      nayapay: '#6C5CE7',
      sadapay: '#00D4AA',
    };
    return colors[method] || '#6B7280';
  };

  const filteredPayments = payments.filter(payment => {
    if (activePaymentTab === 'all') return true;
    return payment.paymentMethod === activePaymentTab;
  });

  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paymentMethods = ['all', 'easypesa', 'jazzcash', 'nayapay', 'sadapay'];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <div style={{ fontSize: '20px' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Premium Payment Requests ({filteredPayments.length})</h2>
        <Button onClick={fetchPendingPayments} variant="outline">
          🔄 Refresh
        </Button>
      </div>

      {/* Payment Method Tabs */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', gap: '0' }}>
          {paymentMethods.map(method => (
            <button
              key={method}
              onClick={() => {
                setActivePaymentTab(method);
                setCurrentPage(1);
              }}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: activePaymentTab === method ? '#f3f4f6' : 'transparent',
                borderBottom: activePaymentTab === method ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: activePaymentTab === method ? 'bold' : 'normal',
                color: activePaymentTab === method ? '#1f2937' : '#6b7280',
                textTransform: 'capitalize'
              }}
            >
              {method === 'all' ? 'All Methods' : method.toUpperCase()}
              {method !== 'all' && ` (${payments.filter(p => p.paymentMethod === method).length})`}
            </button>
          ))}
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
          <p>No pending premium payment requests for {activePaymentTab === 'all' ? 'any method' : activePaymentTab.toUpperCase()}</p>
        </div>
      ) : (
        <>
          {/* Payment List */}
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr 2fr', gap: '16px', alignItems: 'center' }}>
              <div>Patient Name</div>
              <div>Phone</div>
              <div>Email</div>
              <div>Method</div>
              <div>Amount</div>
              <div>Actions</div>
            </div>
            {paginatedPayments.map((payment) => (
              <div
                key={payment.id}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr 2fr',
                  gap: '16px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => {
                  setSelectedPayment(payment);
                  setShowDetailDialog(true);
                }}
              >
                <div style={{ fontWeight: '500' }}>{payment.patient.name}</div>
                <div style={{ color: '#6b7280' }}>{payment.patient.phone}</div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>{payment.patient.email}</div>
                <div>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: getPaymentMethodColor(payment.paymentMethod)
                  }}>
                    {payment.paymentMethod.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontWeight: 'bold', color: '#059669' }}>Rs {payment.amount}</div>
                <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleApprove(payment.id)}
                    disabled={processing}
                    style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPayment(payment);
                      setShowRejectDialog(true);
                    }}
                    disabled={processing}
                    style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
              <Button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                variant="outline"
              >
                Previous
              </Button>
              <span style={{ padding: '0 16px', color: '#6b7280' }}>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      {showDetailDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Payment Details</h2>
              <button onClick={() => setShowDetailDialog(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
          {selectedPayment && (
            <div>
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>Patient Information</h3>
                <p><strong>Name:</strong> {selectedPayment.patient.name}</p>
                <p><strong>Email:</strong> {selectedPayment.patient.email}</p>
                <p><strong>Phone:</strong> {selectedPayment.patient.phone}</p>
              </div>
              
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f0f9ff', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>Payment Information</h3>
                <p><strong>Amount:</strong> Rs {selectedPayment.amount}</p>
                <p><strong>Method:</strong> {selectedPayment.paymentMethod.toUpperCase()}</p>
                <p><strong>Submitted:</strong> {formatDate(selectedPayment.submittedAt)}</p>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>Payment Receipt</h3>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                  <img
                    src={`data:image/jpeg;base64,${selectedPayment.paymentImage}`}
                    alt="Payment Receipt"
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    handleApprove(selectedPayment.id);
                    setShowDetailDialog(false);
                  }}
                  disabled={processing}
                  style={{ background: '#059669', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✅ Approve Payment
                </button>
                <button
                  onClick={() => {
                    setShowDetailDialog(false);
                    setShowRejectDialog(true);
                  }}
                  disabled={processing}
                  style={{ background: '#dc2626', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ❌ Reject Payment
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', maxWidth: '400px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Reject Payment</h2>
              <button onClick={() => { setShowRejectDialog(false); setRejectionReason(''); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ marginBottom: '16px', color: '#6b7280' }}>
              Please provide a reason for rejecting this payment request:
            </p>
            <textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              style={{ width: '100%', marginBottom: '16px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason('');
                }}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Reject Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PremiumPayments;
