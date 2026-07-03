import React from 'react';
import ResumeDownload from './ResumeDownload';
import type { StyleSheetCSS } from './types';

// Structure ported from Henry's components/showcase/Experience.tsx (company h1
// + website h4 / role h3 + bold dates / bulleted body). Deltas per Med:
//  - Only Profectra shows a website.
//  - Both Samsung roles sit under ONE company header (company omitted on the
//    2nd role — same company, two positions).
//  - ALL body text is bullets (no lead-in paragraph), so per-job bullet spacing
//    is uniform.

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
    role: 'Co-Founder',
    dates: '02/2025 - 05/2026',
    bullets: [
      'Co-founded Profectra, an agentic automation studio delivering bespoke multi-agent automation workflows tailored to client operations and business needs.',
      'Worked directly with clients to identify workflow bottlenecks and translate business requirements into practical AI-native products and automation strategies.',
      'Developed MCP-based integrations that enabled AI agents to access client systems, share real-time context, and execute across connected environments.',
      'Designed client applications and interface experiences that translated business requirements into intuitive, modern, and agent-ready digital products.',
      'Drove end-to-end delivery across product design, frontend experience, testing, and launch readiness, applying a strong QA and performance mindset to ship trustworthy agent-first experiences.',
    ],
  },
  {
    company: 'Samsung Electronics America',
    role: 'Senior Software Quality Analyst',
    dates: '02/2020 - 01/2025',
    bullets: [
      'Led testing of AI-powered object recognition and voice assistant features for Samsung devices, boosting accuracy and optimizing user experience across the Galaxy ecosystem.',
      'Conducted performance and KPI testing, analyzing app responsiveness, frame rates, memory usage and overall system stability, accelerating issue resolution by 15%.',
      'Directed cross-departmental collaboration to integrate software releases, train teams, and ensure smooth adoption, achieving 100% alignment across three value streams.',
      'Mentored and managed five QA engineers, fostering a high-performing team environment that increased productivity by 20% through process optimization.',
      'Tested and validated real-time AI features, ensuring low-latency inference and 99.9% uptime for live translation and voice assistant applications.',
    ],
  },
  {
    // same company as above — no header, just the second position
    role: 'Software Quality Analyst',
    dates: '05/2019 - 02/2020',
    bullets: [
      'Developed and implemented test plans for manual and automated testing of network protocols, ensuring adherence to product quality standards and industry benchmarks.',
      'Executed comprehensive performance testing with JMeter, analyzing scalability and improving response times by 25% during peak network loads.',
      'Automated regression testing with Selenium and Appium, boosting efficiency and increasing overall test coverage.',
      'Partnered with cross-functional teams to troubleshoot embedded software issues and validate hardware components, optimizing testing workflows and reducing downtime.',
    ],
  },
  {
    company: 'Apteek Pharma',
    role: 'Quality Analyst',
    dates: '11/2018 - 04/2019',
    bullets: [
      'Created and updated technical documentation, test workflows, and processes, streamlining QA operations and improving team efficiency by 20%.',
      'Directed smoke, functional, and regression testing across QA, SIT, UAT, and PROD environments, ensuring compliance with healthcare IT standards.',
      'Partnered with R&D and clinical teams to implement IT standards and regulatory requirements, ensuring adherence to medical technology guidelines.',
      'Collaborated with stakeholders to define and design performance test requirements, increasing test coverage and enhancing system reliability for healthcare applications.',
    ],
  },
  {
    company: 'Bridge Marketing',
    role: 'Quality Analyst',
    dates: '06/2018 - 11/2018',
    bullets: [
      'Designed and executed test cases for functional, ad-hoc, and exploratory testing, increasing test coverage and ensuring user-friendly marketing platforms.',
      'Validated email marketing functionality across Android and iOS devices, ensuring compatibility and improving user engagement.',
      'Executed RESTful API testing using SOAPUI and Postman, identifying and resolving critical integration issues to enhance system reliability.',
    ],
  },
  {
    company: 'Meritek, Inc',
    role: 'Data Analyst',
    dates: '01/2018 - 04/2018',
    bullets: [
      'Validated database integrity through SQL-driven back-end testing, ensuring accuracy and consistency across web-based applications.',
      'Conducted API testing with SOAP UI for Java-based portals, resolving critical middleware issues and enhancing application performance.',
      'Collaborated with development teams to resolve cross-browser compatibility issues, enhancing user experience and platform reliability.',
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
                    <a rel="noreferrer" target="_blank" href={job.websiteHref}>
                      <h4>{job.websiteLabel}</h4>
                    </a>
                  )}
                </div>
              )}
              <div style={styles.headerRow}>
                <h3>{job.role}</h3>
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
};

export default Experience;
