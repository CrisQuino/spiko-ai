## 🧪 Testing Checklist

Before submitting a PR, ensure:

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` succeeds
- [ ] `npm run test:e2e` passes (if applicable)
- [ ] New tests added for new features
- [ ] No `console.log` left in production code
- [ ] Environment variables documented in `.env.example`
