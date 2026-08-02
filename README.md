# 🎙️ SPIKO.AI - MVP

**AI-Powered Technical English Training for Engineers**

Practice speaking technical English through real production incident simulations.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
spiko-mvp/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── demo/
│   │   │   └── page.tsx       # Interactive demo
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/            # Reusable components (future)
│   └── lib/                   # Utilities (future)
├── public/                    # Static assets
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 🎨 Features Implemented

### ✅ Landing Page
- Hero section with clear value proposition
- Features showcase
- How it works section
- Pricing tiers
- Responsive design
- Smooth animations with Framer Motion

### ✅ Interactive Demo
- Simulated conversation flow
- Text-based input (voice coming soon)
- Real-time feedback hints
- Progress tracking
- Phase-based conversation (intro → diagnosis → resolution → closure)
- Completion screen with scores

### ✅ Design System
- Custom color palette (Primary blue, Accent orange)
- Typography: Space Grotesk (display) + Inter (body)
- Glass morphism effects
- Gradient accents
- Smooth animations

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **State:** Zustand (ready to use)
- **Fonts:** Google Fonts (Space Grotesk, Inter, JetBrains Mono)

---

## 🎯 Next Steps for Full MVP

### Phase 1: Core Functionality (Week 1-2)
- [ ] Integrate real Claude API for conversations
- [ ] Add Web Speech API for voice input
- [ ] Implement ElevenLabs TTS for AI voice
- [ ] Create 3 complete scenarios (DBA, DevOps, Network)
- [ ] Build scenario selection page

### Phase 2: User System (Week 3-4)
- [ ] Add authentication (Supabase Auth)
- [ ] Create user dashboard
- [ ] Implement progress tracking
- [ ] Add conversation history
- [ ] Build vocabulary tracker

### Phase 3: AI Integration (Week 5-6)
- [ ] Full Claude API integration
- [ ] Implement prompt caching
- [ ] Add real-time transcription
- [ ] Build feedback system (grammar, pronunciation, technical)
- [ ] Create scoring algorithm

### Phase 4: Polish (Week 7-8)
- [ ] Add more scenarios (15 total)
- [ ] Implement gamification (streaks, badges)
- [ ] Build team features
- [ ] Add analytics
- [ ] Beta testing with 10 users

---

## 🔧 Configuration

### Environment Variables

Create `.env.local` in root:

```env
# Claude API (Anthropic)
ANTHROPIC_API_KEY=your_key_here

# Supabase (Database & Auth)
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# ElevenLabs (Text-to-Speech)
ELEVENLABS_API_KEY=your_key

# Deepgram (Speech-to-Text) - Optional
DEEPGRAM_API_KEY=your_key
```

---

## 📝 Available Scripts

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
```

---

## 🎨 Design Guidelines

### Colors
- **Primary Blue:** #2563EB (Trust, Tech)
- **Accent Orange:** #F97316 (Energy, Urgency)
- **Success Green:** #10B981
- **Gray Scale:** Slate 50-900

### Typography
- **Headings:** Space Grotesk (Bold, 600, 700)
- **Body:** Inter (Regular, Medium)
- **Code:** JetBrains Mono

### Spacing
- Use Tailwind's spacing scale (4, 6, 8, 12, 16, 20...)
- Generous white space
- Consistent padding/margins

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Other Platforms
- Netlify
- Railway
- Render
- AWS Amplify

---

## 💰 Cost Estimates (Monthly)

### MVP Phase (100 users)
- **Claude API:** ~$10-20 (with caching)
- **ElevenLabs TTS:** ~$15-30
- **Supabase:** Free tier
- **Vercel Hosting:** Free tier
- **Total:** ~$25-50/month

### Growth Phase (1000 users)
- **Claude API:** ~$100-200
- **ElevenLabs TTS:** ~$150-300
- **Supabase:** $25/month
- **Vercel Hosting:** $20/month
- **Total:** ~$300-550/month

---

## 🤝 Contributing

This is an MVP. To contribute:

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

Proprietary - All rights reserved © 2025 SPIKO.AI

---

## 📞 Contact

- Website: https://spiko.ai (coming soon)
- Email: hello@spiko.ai
- Twitter: @spikoai

---

## 🎓 Learning Resources

### For Developers Working on This:
- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [Claude API Docs](https://docs.anthropic.com)
- [Supabase Docs](https://supabase.com/docs)

---

## 🐛 Known Issues

- [ ] Voice input is simulated (not real yet)
- [ ] AI responses are hardcoded (not using real API)
- [ ] No user authentication
- [ ] No database persistence
- [ ] Limited to one scenario

These will be fixed in upcoming sprints.

---

## 🎉 Acknowledgments

Built with ❤️ using:
- Next.js by Vercel
- Tailwind CSS
- Framer Motion
- Claude by Anthropic

---

**Ready to practice? Run `npm run dev` and visit http://localhost:3000/demo**

🚀 Let's make engineers fluent in tech English!
