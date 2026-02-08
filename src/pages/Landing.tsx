import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Shield, PiggyBank, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  { icon: LayoutDashboard, title: 'Smart Dashboard', desc: 'Track room & personal expenses with real-time analytics.' },
  { icon: Shield, title: 'Role-Based Access', desc: 'Admin manages room expenses; users manage their own.' },
  { icon: PiggyBank, title: 'Purse Manager', desc: 'Add funds, auto-deduct expenses, track your balance.' },
  { icon: BarChart3, title: 'Visual Analytics', desc: 'Charts and breakdowns for smarter spending decisions.' },
];

const Landing = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="container mx-auto flex items-center justify-between py-4 px-4">
        <h1 className="text-xl font-bold font-['Space_Grotesk'] text-foreground">RoomExpense</h1>
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/login">Login</Link></Button>
          <Button asChild><Link to="/signup">Get Started</Link></Button>
        </div>
      </div>
    </header>

    <section className="container mx-auto px-4 py-20 lg:py-32 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="text-4xl lg:text-5xl font-bold font-['Space_Grotesk'] text-foreground max-w-2xl mx-auto leading-tight"
      >
        Room & Personal Expense Manager
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}
        className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto"
      >
        Manage shared room expenses, personal budgets, and finances — all in one clean, collaborative platform.
      </motion.p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-8 flex gap-3 justify-center">
        <Button size="lg" asChild><Link to="/signup">Create Account</Link></Button>
        <Button size="lg" variant="outline" asChild><Link to="/login">Sign In</Link></Button>
      </motion.div>
    </section>

    <section className="container mx-auto px-4 pb-20">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i + 0.3, duration: 0.4 }}
            className="bg-card border border-border rounded-xl p-6"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  </div>
);

export default Landing;
