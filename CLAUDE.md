# CLAUDE.md — Sammy Trương | Thần Số Học

## Project Overview

**Tên website:** Sammy Trương
**Chủ đề:** Thần Số Học (Numerology)

Website cá nhân của **Sammy Trương** — chuyên gia thần số học, cung cấp:
- **Luận Giải Cá Nhân** — đọc số mệnh, con số linh hồn, con số định mệnh
- **Ebooks** — sách số học, hướng dẫn tự học
- **Khóa Học** — các khóa học online về thần số học
- **Bài Viết / Blog** — kiến thức, hướng dẫn, chia sẻ

Target audience: Người Việt quan tâm huyền học, tâm linh, tự khám phá bản thân.
Primary language: **Vietnamese**. English dùng cho tiêu đề/nhãn UI accent.

### Branding

- **Tên thương hiệu:** Sammy Trương
- **Logo / Ảnh đại diện:** ⚠️ Chưa có — chủ dự án sẽ cung cấp sau. Dùng placeholder có kích thước đúng (`width={48} height={48}` cho Navbar, `width={120} height={120}` cho Footer/About). Khi logo được cung cấp, đặt tại `public/images/logo.png` (hoặc `.svg`).
- Tên "Sammy Trương" phải xuất hiện nhất quán trên: Navbar, Footer, tab title, OG meta tags.

---

## Design Reference

Dựa trên ảnh `anh nen sammy.png` tại `C:/Users/Admin/website sammy/`.

### Aesthetic
**Deep cosmic purple + sacred geometry.** Không gian vũ trụ tối tăm với ánh sáng huyền bí.
- Nền đen tím sâu với nebula/thiên hà mờ ảo
- Sacred geometry nổi bật: Metatron's Cube / Flower of Life ở hero
- Hành tinh/orbs nổi lơ lửng với glow tím/teal
- Hiệu ứng neon glow trên text và cards
- Layout sạch, tối giản — không rối mắt
- Smooth scroll-reveal animations

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + CSS custom properties
- **Animations:** Framer Motion
- **Icons:** Lucide React + custom SVG sacred geometry
- **Fonts:**
  - Headings: `Cinzel` hoặc `Cormorant Garamond` (huyền bí, sang trọng)
  - Body: `Inter` hoặc `Be Vietnam Pro`
- **Images:** Next.js `<Image>` component, WebP
- **Deployment:** Vercel

---

## Design System

### Color Palette

```css
--color-bg-primary:      #07011A   /* Deep cosmic black-purple */
--color-bg-secondary:    #0F0530   /* Dark violet */
--color-bg-card:         #1A0845   /* Card surface */
--color-accent-purple:   #8B2FC9   /* Primary violet */
--color-accent-neon:     #A855F7   /* Neon purple glow */
--color-accent-teal:     #06B6D4   /* Cosmic teal (planet accent) */
--color-accent-pink:     #EC4899   /* Soft cosmic rose */
--color-glow-primary:    #7C3AED   /* Deep glow violet */
--color-glow-soft:       #C084FC   /* Soft lavender glow */
--color-text-primary:    #F5F0FF   /* Near-white with purple tint */
--color-text-secondary:  #A89BC2   /* Muted lavender */
--color-gold:            #D4AF37   /* Mystical gold highlights */
--color-border:          rgba(168,85,247,0.25)   /* Subtle purple border */
```

### Typography Scale

```css
--text-hero:    clamp(2.5rem, 6vw, 5rem)
--text-h1:      clamp(2rem, 4vw, 3.5rem)
--text-h2:      clamp(1.5rem, 3vw, 2.5rem)
--text-h3:      1.5rem
--text-body:    1rem / 1.75 line-height
--text-small:   0.875rem
```

### Visual Elements

- **Sacred Geometry Hero:** SVG Metatron's Cube với subtle rotation animation, glow tím
- **Cosmic Orbs/Planets:** Radial gradient spheres nổi lơ lửng, parallax nhẹ
- **Nebula Background:** CSS radial-gradient layers mô phỏng thiên hà
- **Starfield:** Canvas hoặc CSS particle stars — tinh tế, không rối
- **Cards:**
  - `background: rgba(26,8,69,0.7)`
  - `backdrop-filter: blur(16px)`
  - Border: `1px solid rgba(168,85,247,0.3)`
  - Hover: glow effect `box-shadow: 0 0 30px rgba(168,85,247,0.4)`
- **Dividers:** Gradient line `purple → transparent → purple`
- **Buttons:**
  - Primary: Gradient `#8B2FC9 → #4F46E5`, rounded-full, neon glow on hover
  - Secondary: Ghost với purple border + glow

### Animation Principles

**BẮT BUỘC: Mọi section đều phải có scroll-triggered animation — không có section nào được render tĩnh.**

- Framer Motion `whileInView` + `viewport={{ once: true, margin: "-80px" }}` cho tất cả sections
- `initial={{ opacity: 0, y: 40 }}` → `whileInView={{ opacity: 1, y: 0 }}`
- Duration: 0.6s, ease: `"easeOut"`
- Stagger children bằng `variants` + `staggerChildren: 0.12s`
- Các kiểu animation theo loại element:
  - **Heading/title:** fade-up (`y: 40 → 0`)
  - **Cards grid:** fade-up staggered, mỗi card delay nhau 0.12s
  - **Ảnh / visual:** fade-in + scale nhẹ (`scale: 0.95 → 1`)
  - **Divider/line:** width expand (`scaleX: 0 → 1`, origin left)
  - **Icon/badge:** fade-in + rotate nhẹ (`rotate: -10 → 0`)
  - **CTA buttons:** fade-up cuối cùng sau content
- Sacred geometry: slow continuous rotation (360deg / 60s)
- Floating orbs: `y` keyframe ±12px, 5s infinite ease-in-out
- Stars: twinkle opacity 0.3 → 1, random delay per star
- KHÔNG auto-play video/audio
- Dùng `useReducedMotion()` của Framer Motion để tắt animation khi user bật accessibility setting

---

## Site Structure

```
/                       → Trang Chủ (Home)
/luan-giai              → Luận Giải Cá Nhân (Personal Readings)
/khoa-hoc               → Khóa Học (Courses)
/ebook                  → Ebooks
/bai-viet               → Bài Viết / Blog
/lien-he                → Liên Hệ (Contact)
```

---

## Pages & Sections

### Trang Chủ (`/`)

1. **Hero** — Full-screen cosmic BG, Metatron's Cube SVG ở center/right, headline lớn, subtitle, 2 CTA buttons
2. **Core Numbers Grid** — 5 thẻ ngang: Số Linh Hồn / Số Định Mệnh / Số Nghiệp / Phẩm Chất Tâm Linh / Thần Số Vũ Trụ (theo layout ảnh)
3. **Giới Thiệu** — "Thần Số Học Vũ Trụ" — intro ngắn gọn về dịch vụ, ảnh huyền bí
4. **Dịch Vụ Nổi Bật** — Cards: Luận Giải / Ebook / Khóa Học, mỗi card có icon, title, mô tả ngắn, CTA
5. **Tại Sao Chọn Chúng Tôi** — 3–4 điểm mạnh với icon
6. **Testimonials** — Quote từ khách hàng, avatar tròn, card style tối
7. **Bài Viết Mới Nhất** — Grid 3 bài blog gần nhất
8. **CTA Banner** — "Khám Phá Con Số Của Bạn" với form email đơn giản

### Luận Giải Cá Nhân (`/luan-giai`)

- Hero nhỏ với title
- Giải thích các loại luận giải (Số Sinh, Số Tên, Số Ngày, Biểu Đồ Đầy Đủ)
- Pricing cards (3 gói: Cơ Bản / Chuyên Sâu / Toàn Diện)
- Process: 3 bước đặt lịch
- FAQ accordion
- CTA liên hệ

### Khóa Học (`/khoa-hoc`)

- Grid khóa học, mỗi card: thumbnail, tên, level, số bài, giá, CTA
- Filter theo level (Nhập Môn / Trung Cấp / Nâng Cao)

### Ebooks (`/ebook`)

- Grid sách: cover ảnh, tên, mô tả ngắn, giá, nút Mua / Tải
- Badge "Bestseller" / "Mới" nếu cần

### Bài Viết (`/bai-viet`)

- Grid bài viết, filter theo chủ đề
- Mỗi card: thumbnail, title, ngày, excerpt, đọc thêm

### Liên Hệ (`/lien-he`)

- Form: Họ tên, email, chủ đề (dropdown: Luận Giải / Khóa Học / Ebook / Khác), tin nhắn
- Social links: Facebook, YouTube, Zalo, TikTok
- Thời gian phản hồi dự kiến

---

## Component Guidelines

### Naming Convention

- Components: PascalCase (`HeroSection.tsx`, `NumberCard.tsx`)
- Utilities/hooks: camelCase (`useScrollReveal.ts`, `useParticles.ts`)
- Pages: Next.js App Router (`app/luan-giai/page.tsx`)

### Key Reusable Components

```
<CosmicBackground>        — Layered nebula gradient + starfield canvas
<SacredGeometry>          — SVG Metatron's Cube với rotation animation
<FloatingPlanet>          — Gradient orb với floating animation
<GlowCard>                — Card blur + glow border
<GradientText>            — Text với violet→pink gradient fill
<SectionTitle>            — Centered heading + decorative geometry line
<PrimaryButton>           — Gradient button với neon glow hover
<GhostButton>             — Ghost button violet border
<NumerologyCard>          — Card cho Core Numbers (icon + title + desc)
<ServiceCard>             — Card dịch vụ với hover glow
<PricingCard>             — Card gói dịch vụ (Basic/Pro/Ultimate)
<TestimonialCard>         — Quote + avatar
<SectionDivider>          — Gradient divider line
<BlogCard>                — Bài viết card
```

---

## Content Tone & Voice

- Huyền bí, chuyên nghiệp, đáng tin cậy — như một người thầy tâm linh
- Không quá thần bí hay mê tín — giữ tông khoa học huyền học
- Dùng ngôn ngữ ánh sáng, khám phá, tự nhận thức
- Câu ngắn, dễ đọc, mang tính truyền cảm hứng
- Tránh ngôn ngữ bán hàng quá lộ liễu

---

## SEO & Performance

- Vietnamese meta titles/descriptions mỗi trang
- `lang="vi"` trên `<html>`
- Structured data cho courses, products (JSON-LD)
- OG images dark-themed cho social sharing
- Core Web Vitals: LCP < 2.5s
- Lazy-load images, embed video
- `next/font` cho zero layout shift

---

## File Structure

```
app/
  layout.tsx
  page.tsx
  luan-giai/page.tsx
  khoa-hoc/page.tsx
  ebook/page.tsx
  bai-viet/
    page.tsx
    [slug]/page.tsx
  lien-he/page.tsx
components/
  layout/
    Navbar.tsx
    Footer.tsx
  ui/
    GlowCard.tsx
    PrimaryButton.tsx
    GhostButton.tsx
    GradientText.tsx
    SectionTitle.tsx
    SectionDivider.tsx
    CosmicBackground.tsx
    SacredGeometry.tsx
    FloatingPlanet.tsx
    NumerologyCard.tsx
    ServiceCard.tsx
    PricingCard.tsx
    TestimonialCard.tsx
    BlogCard.tsx
  sections/
    HeroSection.tsx
    CoreNumbersSection.tsx
    IntroSection.tsx
    ServicesSection.tsx
    WhyUsSection.tsx
    TestimonialsSection.tsx
    LatestPostsSection.tsx
    CtaSection.tsx
lib/
  utils.ts
  numerology.ts       ← helper tính số học (nếu có calculator)
public/
  images/
    hero/
    services/
    ebooks/
    blog/
  fonts/
```

---

## Important Constraints

### Bắt buộc tuyệt đối
- **MOBILE-FRIENDLY:** Mọi layout, component, section phải hoạt động hoàn hảo trên màn hình 375px trở lên. Kiểm tra breakpoints: `sm (640px)` / `md (768px)` / `lg (1024px)` / `xl (1280px)`. Không có element nào bị tràn ngang, text không quá nhỏ (<14px) trên mobile.
- **SCROLL ANIMATION BẮT BUỘC:** 100% sections phải có Framer Motion `whileInView` animation. Không được bỏ qua section nào kể cả Divider, Footer hay section nhỏ.

### Thiết kế
- KHÔNG dùng nền trắng hay sáng — luôn dark cosmic purple tones
- KHÔNG dùng stock photo phong cách corporate — ưu tiên cosmic, abstract, sacred geometry
- KHÔNG dùng font system mặc định — chỉ dùng Cinzel + Inter/Be Vietnam Pro
- Sacred geometry SVG phải inline (không dùng img tag) để có thể animate

### Development
- KHÔNG thêm feature ngoài scope trên mà không hỏi trước
- Bundle size gọn — không dùng MUI, Chakra, hay UI library nặng
- Mọi text hiển thị cho user phải bằng tiếng Việt (trừ brand names, UI conventions)
- Responsive-first: mobile → tablet → desktop
- Navbar trên mobile: hamburger menu, collapse thành drawer/overlay

### Checklist trước khi hoàn thành bất kỳ page nào
- [ ] Tất cả sections có `whileInView` animation
- [ ] Kiểm tra layout trên viewport 375px (iPhone SE)
- [ ] Kiểm tra layout trên viewport 768px (tablet)
- [ ] Tên "Sammy Trương" hiển thị đúng trên Navbar và Footer
- [ ] Placeholder logo đúng kích thước, dễ thay thế sau
