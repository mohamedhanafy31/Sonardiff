import { Resend } from 'resend';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

const resend = new Resend(config.resendApiKey);

function wrapDiffInEmailChrome(monitorName: string, monitorUrl: string, diffHtmlFragment: string): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f8f9fa; padding: 20px; border-bottom: 1px solid #ddd;">
        <h2 style="margin: 0; color: #2c3e50;">Change Detected: ${monitorName}</h2>
        <p style="margin: 10px 0 0 0;"><a href="${monitorUrl}" style="color: #3498db; text-decoration: none;">View Live Page</a></p>
      </div>
      <div style="padding: 20px;">
        ${diffHtmlFragment}
      </div>
      <div style="background-color: #f8f9fa; padding: 15px 20px; font-size: 12px; color: #7f8c8d; border-top: 1px solid #ddd; text-align: center;">
        Sent by SonarDiff Monitoring Engine
      </div>
    </div>
  `;
}

export async function sendAlertEmail(
  toEmail: string,
  monitorName: string,
  monitorUrl: string,
  diffHtmlFragment: string
): Promise<boolean> {
  if (!config.resendApiKey || config.resendApiKey === 're_placeholder') {
    logger.warn('RESEND_API_KEY is missing or placeholder. Skipping email alert.');
    return false;
  }

  try {
    const htmlContent = wrapDiffInEmailChrome(monitorName, monitorUrl, diffHtmlFragment);

    const { data, error } = await resend.emails.send({
      from: 'SonarDiff Alerts <alerts@sonardiff.com>',
      to: toEmail,
      subject: `[SonarDiff] Change Detected on ${monitorName}`,
      html: htmlContent,
    });

    if (error) {
      logger.error({ error, toEmail, monitorName }, 'Failed to send alert email via Resend');
      return false;
    }

    logger.info({ emailId: data?.id, toEmail, monitorName }, 'Alert email sent successfully');
    return true;
  } catch (err) {
    logger.error({ err, toEmail, monitorName }, 'Exception while sending alert email');
    return false;
  }
}

export async function sendElementMissingAlert(
  toEmail: string,
  monitorName: string,
  monitorUrl: string
): Promise<boolean> {
  if (!config.resendApiKey || config.resendApiKey === 're_placeholder') {
    logger.warn('RESEND_API_KEY is missing or placeholder. Skipping element missing alert.');
    return false;
  }

  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #fff3cd; padding: 20px; border-bottom: 1px solid #ddd;">
          <h2 style="margin: 0; color: #856404;">Monitored Element No Longer Found: ${monitorName}</h2>
          <p style="margin: 10px 0 0 0;"><a href="${monitorUrl}" style="color: #3498db; text-decoration: none;">View Live Page</a></p>
        </div>
        <div style="padding: 20px;">
          <p>The CSS selector you configured for <strong>${monitorName}</strong> no longer matches any element on the page.</p>
          <p>SonarDiff attempted automatic selector recovery but could not locate the element. Please update your monitor configuration.</p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px 20px; font-size: 12px; color: #7f8c8d; border-top: 1px solid #ddd; text-align: center;">
          Sent by SonarDiff Monitoring Engine
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: 'SonarDiff Alerts <alerts@sonardiff.com>',
      to: toEmail,
      subject: `[SonarDiff] Monitored element no longer found — ${monitorName}`,
      html: htmlContent,
    });

    if (error) {
      logger.error({ error, toEmail, monitorName }, 'Failed to send element missing alert');
      return false;
    }

    logger.info({ emailId: data?.id, toEmail, monitorName }, 'Element missing alert sent');
    return true;
  } catch (err) {
    logger.error({ err, toEmail, monitorName }, 'Exception while sending element missing alert');
    return false;
  }
}
