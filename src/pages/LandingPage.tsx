import About from '../components/About'
import CTA from '../components/CTA'
import Features from '../components/Features'
import Hero from '../components/Hero'
import HowItWorks from '../components/HowItWorks'
import ScrollReveal from '../components/ScrollReveal'
import Testimonials from '../components/Testimonials'

export default function LandingPage() {
  return (
    <>
      <Hero />
      <About />
      <ScrollReveal />
      <Features />
      <HowItWorks />
      <Testimonials />
      <CTA />
    </>
  )
}
