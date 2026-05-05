import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AccessDeniedScreen from '@/components/AccessDeniedScreen';
import AdminUsers from './pages/AdminUsers';
import Quotes from './pages/Quotes';
import ClientGallery from './pages/ClientGallery';
import Contacts from './pages/Contacts';
import SubVendors from './pages/SubVendors';
import Analytics from './pages/Analytics';
import LeadImport from './pages/LeadImport';
import RBACMatrix from './pages/RBACMatrix';
import QuoteView from './pages/QuoteView';
import QuoteTemplates from './pages/QuoteTemplates';
import PublicLeadForm from './pages/PublicLeadForm';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AccessibilityPage from './pages/Accessibility';
import Newsletter from './pages/Newsletter';
import MagicGallery from './pages/MagicGallery';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  // Closed-system gate: only users whose email exists in the TeamMember table can enter.
  // Also syncs the User.role from TeamMember.role so client/admin/user views work correctly.
  const { data: teamMember, isLoading: isLoadingTeamMember } = useQuery({
    queryKey: ['teamMemberAccess', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const list = await base44.entities.TeamMember.filter({ email: user.email.toLowerCase() });
      const member = list[0] || null;
      // Sync role from TeamMember -> User entity so the rest of the app (Layout, FileStorage, etc.)
      // sees the correct role (e.g. 'client').
      if (member && member.role && member.role !== user.role) {
        try {
          await base44.auth.updateMe({ role: member.role });
          window.location.reload();
        } catch (e) {
          console.error('role sync failed', e);
        }
      }
      return member;
    },
    enabled: !!user?.email,
  });

  const isAllowedUser = user && (
    user.email === 'natigold04@gmail.com' ||
    (teamMember && teamMember.is_active !== false)
  );

  // Show loading spinner while checking app public settings, auth, or team membership
  if (isLoadingPublicSettings || isLoadingAuth || (user && isLoadingTeamMember)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Block users without an allowed role
  if (user && !isAllowedUser) {
    return <AccessDeniedScreen user={user} />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      <Route path="/AdminUsers" element={
        <LayoutWrapper currentPageName="AdminUsers">
          <AdminUsers />
        </LayoutWrapper>
      } />
      <Route path="/Quotes" element={
        <LayoutWrapper currentPageName="Quotes">
          <Quotes />
        </LayoutWrapper>
      } />
      <Route path="/QuoteTemplates" element={
        <LayoutWrapper currentPageName="QuoteTemplates">
          <QuoteTemplates />
        </LayoutWrapper>
      } />
      <Route path="/Contacts" element={
        <LayoutWrapper currentPageName="Contacts">
          <Contacts />
        </LayoutWrapper>
      } />
      <Route path="/SubVendors" element={
        <LayoutWrapper currentPageName="SubVendors">
          <SubVendors />
        </LayoutWrapper>
      } />
      <Route path="/Analytics" element={
        <LayoutWrapper currentPageName="Analytics">
          <Analytics />
        </LayoutWrapper>
      } />
      <Route path="/LeadImport" element={
        <LayoutWrapper currentPageName="LeadImport">
          <LeadImport />
        </LayoutWrapper>
      } />
      <Route path="/RBACMatrix" element={
        <LayoutWrapper currentPageName="RBACMatrix">
          <RBACMatrix />
        </LayoutWrapper>
      } />
      <Route path="/PrivacyPolicy" element={
        <LayoutWrapper currentPageName="PrivacyPolicy">
          <PrivacyPolicy />
        </LayoutWrapper>
      } />
      <Route path="/TermsOfService" element={
        <LayoutWrapper currentPageName="TermsOfService">
          <TermsOfService />
        </LayoutWrapper>
      } />
      <Route path="/Accessibility" element={
        <LayoutWrapper currentPageName="Accessibility">
          <AccessibilityPage />
        </LayoutWrapper>
      } />
      <Route path="/Newsletter" element={
        <LayoutWrapper currentPageName="Newsletter">
          <Newsletter />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <Routes>
            <Route path="/gallery/:id" element={<ClientGallery />} />
            <Route path="/g/:token" element={<MagicGallery />} />
            <Route path="/quote/view" element={<QuoteView />} />
            <Route path="/contact" element={<PublicLeadForm />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App