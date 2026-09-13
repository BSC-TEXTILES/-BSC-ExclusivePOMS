import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignUp, useAuth as useClerkAuth } from '@clerk/clerk-react';

export default function SignUpPage() {
  const { isSignedIn } = useClerkAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn) navigate('/dashboard', { replace: true });
  }, [isSignedIn, navigate]);

  return (
    <div className="login-page">
      <div className="login-left">
        <button
          type="button"
          className="login-back-home-btn"
          onClick={() => navigate('/landing')}
          title="Back to Home"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to Home</span>
        </button>

        <div className="login-left-content">
          <div className="login-left-brand">
            <div className="login-left-logo">B</div>
            <span>BSC Exclusive</span>
          </div>
          <div className="login-left-hero">
            <h1>Purchase Order<br />Management System</h1>
            <p>Next-generation enterprise procurement platform with matrix size quantities, multi-tier approvals, branded PDF/CSV exports, and goods receipt tracking.</p>
          </div>

          <div className="login-left-features">
            <div className="login-feature">
              <div className="login-feature-icon">1</div>
              <div>
                <div className="login-feature-title">PO Drafting & Size Matrix</div>
                <div className="login-feature-desc">Purchase Executives configure item sizing grids, costs, margins & discounts.</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">2</div>
              <div>
                <div className="login-feature-title">Tiered Approval Governance</div>
                <div className="login-feature-desc">Purchase Managers & Approvers enforce budgets, margin limits & threshold rules.</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">3</div>
              <div>
                <div className="login-feature-title">Branded PDF & Detailed CSV Export</div>
                <div className="login-feature-desc">Vectorized A4 purchase orders with BSC branding, GSTIN breakdown & signature blocks.</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">4</div>
              <div>
                <div className="login-feature-title">Warehouse GRN & Inventory</div>
                <div className="login-feature-desc">Receiving bay records deliveries, inspects defects, and updates live warehouse stock.</div>
              </div>
            </div>
          </div>

          <div className="login-left-footer">&copy; 2026 BSC Exclusive Private Limited. All rights reserved.</div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
          <div className="login-form-header">
            <div className="login-form-logo">
              <img src="/bsc-logo.png" alt="BSC" />
            </div>
            <h2>Create your account</h2>
            <p>Sign up for BSC Purchase Order Management System</p>
          </div>

          <SignUp
            routing="path"
            path="/signup"
            signInUrl="/login"
            appearance={{
              elements: {
                rootBox: { width: '100%', maxWidth: 400 },
                card: { width: '100%' },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
