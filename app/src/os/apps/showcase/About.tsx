import React from 'react';
import { Link } from 'react-router-dom';
import ResumeDownload from './ResumeDownload';

// Structure ported from Henry's components/showcase/About.tsx.
// Content: Med's own bio (hero + about + current focus + experience snapshot
// + areas of expertise). Henry's two captioned photos removed pending Med's
// own photos — the layout slots come back when he provides them.

export interface AboutProps {}

const About: React.FC<AboutProps> = () => {
  return (
    <div className="site-page-content">
      <h1 style={{ marginLeft: -16 }}>Welcome</h1>
      <h3>I'm Mohamed Tabari</h3>
      <br />
      <div className="text-block">
        <p>
          Senior QA Engineer with <b>8+ years</b> of experience delivering
          manual, automated, mobile, embedded, and AI-feature quality assurance
          for enterprise-scale products. Expertise spans Android/iOS device
          testing, firmware and carrier validation, API and performance
          testing, plus automation using Playwright, Selenium, Appium,
          Python/pytest, and CI/CD. Led validation across 100+ physical devices
          and 30+ Galaxy models while mentoring QA engineers and accelerating
          defect resolution in high-release-cadence environments.
        </p>
        <br />
        <p>
          This portfolio showcases selected work across software engineering,
          AI systems, automation, and digital product development. It reflects
          a practical approach to building technology that combines technical
          depth, structured execution, and product-minded thinking. If you
          have any questions or comments, feel free to contact me using{' '}
          <Link to="/os/contact">this form</Link>.
        </p>
      </div>
      <ResumeDownload />
      <div className="text-block">
        <h3>About Me</h3>
        <br />
        <p>
          I work at the intersection of <b>engineering rigor</b>,{' '}
          <b>systems thinking</b>, and <b>product execution</b>. Over the
          years, I have built experience across software testing, automation,
          performance validation, AI-powered features, and cross-functional
          delivery, with a consistent emphasis on quality, reliability, and
          operational clarity.
        </p>
        <br />
        <p>
          That foundation has evolved into a broader focus on{' '}
          <b>AI-native systems</b>, <b>agentic workflows</b>, and
          automation-first products. I am particularly interested in building
          solutions that do more than demonstrate technical capability — they
          need to be dependable, useful, and valuable in real operating
          environments.
        </p>
        <br />
        <p>
          In addition to engineering execution, I have also worked on
          designing applications and digital experiences for clients. That
          product perspective helps me build systems that are not only
          functional, but intuitive, trustworthy, and aligned with how people
          actually work.
        </p>
        <br />
        <br />
        <h3>Current Focus</h3>
        <br />
        <p>
          My current focus is on the design and development of{' '}
          <b>AI-assisted systems</b>, <b>automation workflows</b>, and{' '}
          <b>agentic architectures</b> that reduce manual effort and improve
          execution quality. This includes exploring orchestration models,
          multi-agent coordination, context management, and practical ways to
          connect AI capabilities with business operations.
        </p>
        <br />
        <p>
          I place strong emphasis on structure, control, and reliability. That
          means thinking beyond automation itself and focusing on workflow
          quality, review mechanisms, execution guardrails, and product
          usability across both internal and client-facing systems.
        </p>
        <br />
        <br />
        <h3>Experience Snapshot</h3>
        <br />
        <p>
          My professional background includes engineering and quality-focused
          work across the United States, with deep involvement in{' '}
          <b>AI feature testing</b>, <b>low-latency systems</b>, mobile and
          web applications, automation strategy, API validation, and
          performance analysis. That experience gave me a strong technical
          foundation for shipping software that is dependable, measurable, and
          ready for production environments.
        </p>
        <br />
        <p>
          More recently, my work has expanded into co-founding, solution
          design, automation architecture, and product development. The result
          is a profile that bridges software engineering, AI systems, workflow
          thinking, and business-oriented execution. You can read more on the{' '}
          <Link to="/os/experience">experience page</Link>.
        </p>
        <br />
        <br />
        <h3>Areas of Expertise</h3>
        <br />
        <ul>
          <li>
            <p>AI systems and agentic workflow design.</p>
          </li>
          <li>
            <p>Automation architecture and multi-step execution models.</p>
          </li>
          <li>
            <p>
              Software quality, validation strategy, and performance
              engineering.
            </p>
          </li>
          <li>
            <p>Web, mobile, and AI-powered product delivery.</p>
          </li>
          <li>
            <p>Client application design and AI-native user experiences.</p>
          </li>
          <li>
            <p>
              Cross-functional execution across design, engineering, testing,
              and launch.
            </p>
          </li>
        </ul>
        <br />
        <p>
          For professional inquiries, collaborations, or consulting
          opportunities, please get in touch through the{' '}
          <Link to="/os/contact">contact page</Link>.
        </p>
      </div>
    </div>
  );
};

export default About;
