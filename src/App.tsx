import { Suspense, lazy, useEffect } from 'react';
import { AppProvider, useApp } from './AppContext';
import { Layout } from './components/Layout';
import { useRoute, type Route } from './router';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { Product } from './pages/Product';
import { Cart } from './pages/Cart';
import { Seo } from './components/Seo';

// Pages most shoppers never open load on demand, so the first visit downloads far less.
const Checkout = lazy(() => import('./pages/Checkout').then((m) => ({ default: m.Checkout })));
const Order = lazy(() => import('./pages/Order').then((m) => ({ default: m.Order })));
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })));
const Forgot = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Forgot })));
const Reset = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Reset })));
const Account = lazy(() => import('./pages/Account').then((m) => ({ default: m.Account })));
const Gifts = lazy(() => import('./pages/Gifts').then((m) => ({ default: m.Gifts })));
const GiftCards = lazy(() => import('./pages/GiftCards').then((m) => ({ default: m.GiftCards })));
const Finder = lazy(() => import('./pages/Finder').then((m) => ({ default: m.Finder })));
const About = lazy(() => import('./pages/Info').then((m) => ({ default: m.About })));
const Contact = lazy(() => import('./pages/Info').then((m) => ({ default: m.Contact })));
const Faq = lazy(() => import('./pages/Info').then((m) => ({ default: m.Faq })));
const Doc = lazy(() => import('./pages/Info').then((m) => ({ default: m.Doc })));
const NotFound = lazy(() => import('./pages/Info').then((m) => ({ default: m.NotFound })));
const Track = lazy(() => import('./pages/Track').then((m) => ({ default: m.Track })));
const Admin = lazy(() => import('./admin/Admin').then((m) => ({ default: m.Admin })));
const Invoice = lazy(() => import('./pages/Invoice').then((m) => ({ default: m.Invoice })));
const Labels = lazy(() => import('./pages/Labels').then((m) => ({ default: m.Labels })));
const DOC_KEYS = ['shipping', 'care', 'privacy', 'terms'];

/** Shown for a moment while a page's code arrives; the header and footer stay put around it. */
const Waiting = () => <div className="page" style={{ minHeight: '60vh' }} aria-busy="true" />;


function Page({ route }: { route: Route }) {
  const { setCartOpen, setQv } = useApp();
  // overlays never survive navigation
  useEffect(() => { setCartOpen(false); setQv(null); }, [route.name, route.arg, setCartOpen, setQv]);

  return (
    <>
      <Seo route={route} />
      <Suspense fallback={<Waiting />}>{renderPage(route)}</Suspense>
    </>
  );
}

function renderPage(route: Route) {
  switch (route.name) {
    case 'home': return <Home />;
    case 'shop': return <Shop route={route} />;
    case 'product': return <Product route={route} />;
    case 'cart': return <Cart />;
    case 'checkout': return <Checkout />;
    case 'order': return <Order route={route} />;
    case 'login': return <Login route={route} />;
    case 'register': return <Register route={route} />;
    case 'forgot': return <Forgot />;
    case 'reset': return <Reset />;
    case 'account': return <Account route={route} />;
    case 'track': return <Track route={route} />;
    case 'gifts': return <Gifts />;
    case 'gift-cards': return <GiftCards />;
    case 'finder': return <Finder />;
    case 'about': return <About />;
    case 'contact': return <Contact />;
    case 'faq': return <Faq />;
    default: return DOC_KEYS.includes(route.name) ? <Doc name={route.name} /> : <NotFound />;
  }
}

export default function App() {
  const route = useRoute();
  if (route.name === 'admin') return <Suspense fallback={null}><Admin route={route} /></Suspense>;
  if (route.name === 'invoice') return <AppProvider><Suspense fallback={null}><Invoice route={route} /></Suspense></AppProvider>;
  if (route.name === 'labels') return <AppProvider><Suspense fallback={null}><Labels route={route} /></Suspense></AppProvider>;
  return (
    <AppProvider>
      <Layout>
        <Page route={route} />
      </Layout>
    </AppProvider>
  );
}
