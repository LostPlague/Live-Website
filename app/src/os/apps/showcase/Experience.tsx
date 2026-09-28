import React from 'react';
import ResumeDownload from './ResumeDownload';
import type { StyleSheetCSS } from './types';
import { track } from '../../../analytics';

// Structure ported from Henry's components/showcase/Experience.tsx (company h1
// + website h4 / role h3 + bold dates / bulleted body). Deltas per Med:
//  - Only Profectra shows a website.
//  - Both Samsung roles sit under ONE company header (company omitted on the
//    2nd role — same company, two positions).
//  - ALL body text is bullets (no lead-in paragraph), so per-job bullet spacing
//    is uniform.
// Content synced 2026-09-28 from "Mohamed Tabari -Software QA.docx"
// (Med's updated Software QA resume). Languages section deliberately excluded.

interface Role {
  company?: string; // omitted → same company as the role above it
  websiteLabel?: string;
  websiteHref?: string;
  role: string;
  dates: string;
  bullets: string[];
}

const experience: Role[] = [
  {
    company: 'Profectra',
    websiteLabel: 'www.profectra.com',
    websiteHref: 'https://www.profectra.com',
    role: 'Co-Founder | Quality Assurance & AI Agent Testing',
    dates: '02/2025 - 06/2026',
    bullets: [
      'Co-founded Profectra, an agentic automation studio building multi-agent systems end to end, including architecture, implementation, QA, and deployment.',
      'Shipped several production web and AI-agent applications, owning test strategy, automated regression coverage, release validation, and deployment.',
      'Translated product requirements into practical test plans and release criteria, helping prioritize risks and keep delivery aligned with user needs.',
      'Developed cross-browser regression coverage in TypeScript using Playwright, containerized with Docker and integrated into GitHub Actions CI/CD.',
      'Built automated quality checks in Python and pytest for AI outputs and REST APIs, detecting silent failures and validating critical behavior on every commit.',
      'Configured and validated MCP-based integrations connecting AI agents to external tools under a read-only permission model, following source-level dependency audits.',
    ],
  },
  {
    company: 'Samsung Electronics America',
    role: 'Senior Software Quality Analyst',
    dates: '02/2020 - 01/2025',
    bullets: [
      'Ran extensive manual functional, regression, performance, network, and OTA update testing on phones, tablets, and wearables for every major firmware release.',
      'Filed, triaged, and tracked 20+ defects per week in Jira and PLM across near-daily firmware builds, using ADB and Android Studio logcat to identify root causes and working with teams to prioritize fixes, report release status, and accelerate resolution by 15%.',
      'Updated and maintained existing Appium test suites, adding coverage for new features and running them through Jenkins CI.',
      'Led testing of AI object recognition, live translation, and voice assistants across 30+ Galaxy models, evaluating Arabic, French, and English accuracy, RTL rendering, latency, and reliability.',
      'Mentored and managed five QA engineers and directed cross-departmental release integration across three value streams, increasing productivity by 20%.',
    ],
  },
  {
    // same company as above — no header, just the second position
    role: 'Software Quality Analyst',
    dates: '05/2019 - 02/2020',
    bullets: [
      'Developed and implemented test plans for manual and automated testing of network protocols, ensuring adherence to product quality standards and industry benchmarks.',
      'Ran performance testing on devices, measuring app launch time, memory use, and network throughput with ADB, Android Studio Profiler, and QCAT, improving response times by 25%.',
      'Automated regression testing with Selenium and Appium, integrated into Jenkins CI pipelines, boosting efficiency and increasing overall test coverage.',
      'Partnered with cross-functional teams to troubleshoot software issues using ADB and Android Studio logcat analysis, and validate hardware components, optimizing testing workflows and reducing downtime.',
    ],
  },
  {
    company: 'Apteek Pharma',
    role: 'Quality Analyst',
    dates: '11/2018 - 04/2019',
    bullets: [
      'Created and updated technical documentation, test workflows, and processes, streamlining QA operations and improving team efficiency.',
      'Performed smoke, functional, and regression testing across QA, SIT, UAT, and PROD environments, ensuring compliance with healthcare IT standards.',
      'Partnered with R&D and clinical teams to implement IT standards and regulatory requirements, ensuring adherence to medical technology guidelines.',
    ],
  },
  {
    company: 'Bridge Marketing',
    role: 'Quality Analyst',
    dates: '06/2018 - 11/2018',
    bullets: [
      'Designed and executed functional, exploratory, and regression test cases for web marketing platforms, automating repeat checks with Selenium to increase coverage.',
      'Validated email marketing functionality across Android and iOS devices using ADB and Xcode simulators, ensuring compatibility and improving user engagement.',
      'Executed RESTful API testing using SoapUI and Postman, identifying and resolving critical integration issues to enhance system reliability.',
    ],
  },
  {
    company: 'Meritek, Inc',
    role: 'Analyst',
    dates: '01/2018 - 04/2018',
    bullets: [
      'Validated database integrity through SQL-driven back-end testing across multiple web-based applications, ensuring data accuracy and consistency between the front end and the underlying tables.',
      'Conducted API testing with SoapUI against Java-based portals, identifying and resolving critical middleware integration issues that were degrading application performance and response times.',
      'Collaborated with development teams to reproduce and resolve cross-browser compatibility issues affecting end users, improving overall user experience and platform reliability across supported browsers.',
    ],
  },
];

export interface ExperienceProps {}

const Experience: React.FC<ExperienceProps> = () => {
  return (
    <div className="site-page-content">
      <ResumeDownload />
      {experience.map((job, i) => (
        <React.Fragment key={i}>
          <div style={styles.headerContainer}>
            <div style={styles.header}>
              {job.company && (
                <div style={styles.headerRow}>
                  <h1>{job.company}</h1>
                  {job.websiteHref && (
                    <a rel="noreferrer" target="_blank" href={job.websiteHref}
                      onClick={() => track('link_clicked', { target: 'job-site', company: job.company })}>
                      <h4>{job.websiteLabel}</h4>
                    </a>
                  )}
                </div>
              )}
              <div style={styles.headerRow}>
                {/* Long titles (e.g. "Co-Founder | QA Automation & AI Agent
                    Testing") wrapped to two lines at the 24px h3 size while
                    every other role sat on one. Keep the full text, scale it to
                    fit on a single line instead. */}
                <h3 style={job.role.length > 32 ? styles.roleLong : undefined}>{job.role}</h3>
                <b>
                  <p>{job.dates}</p>
                </b>
              </div>
            </div>
          </div>
          <div className="text-block">
            <ul>
              {job.bullets.map((bullet, j) => (
                <li key={j}>
                  <p>{bullet}</p>
                </li>
              ))}
            </ul>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

const styles: StyleSheetCSS = {
  header: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerContainer: {
    alignItems: 'flex-end',
    width: '100%',
    justifyContent: 'center',
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  // scales with the window so the title stays on ONE line as the OS window
  // resizes; ellipsis is the last-resort guard on very narrow windows.
  roleLong: {
    fontSize: 'clamp(14px, 1.6vw, 20px)',
    whiteSpace: 'nowrap',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default Experience;
