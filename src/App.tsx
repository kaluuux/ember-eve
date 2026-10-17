import { useEffect } from 'react';
import { AppProvider, useApp } from './AppContext';
import { Layout } from './components/Layout';
import { useRoute, type Route } from './router';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { Product } from './pages/Product';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Order } from './pages/Order';
import { Forgot, Login, Register, Reset } from './pages/Auth';
import { Account } from './pages/Account';
import { Gifts } from './pages/Gifts';
import { GiftCards } from './pages/GiftCards';
import { Finder } from './pages/Finder';
import { About, Contact, DOC_KEYS, Doc, Faq, NotFound } from './pages/Info';
import { Track } from './pages/Track';
import { Admin } from './admin/Admin';
import { Invoice } from './pages/Invoice';
import { Labels } from './pages/Labels';
import { Seo } from './components/Seo';

function Page({ route }: { route: Route }) {
  const { setCartOpen, setQv } = useApp();
  // overlays never survive navigation
  useEffect(() => { setCartOpen(false); setQv(null); }, [route.name, route.arg, setCartOpen, setQv]);

  return (
    <>
      <Seo route={route} />
      {renderPage(route)}
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
  if (route.name === 'admin') return <Admin route={route} />;
  if (route.name === 'invoice') return <AppProvider><Invoice route={route} /></AppProvider>;
  if (route.name === 'labels') return <AppProvider><Labels route={route} /></AppProvider>;
  return (
    <AppProvider>
      <Layout>
        <Page route={route} />
      </Layout>
    </AppProvider>
  );
}
