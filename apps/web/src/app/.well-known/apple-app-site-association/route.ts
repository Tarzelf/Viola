import { NextResponse } from 'next/server';

/**
 * Apple Universal Links association file.
 * Replace TEAMID with the real Apple Team ID before production.
 */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID ?? 'TEAMID';
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [`${teamId}.app.viola.ios`],
          components: [
            { '/': '/l/*', comment: 'Public look share pages' },
            { '/': '/@*', comment: 'Profile pages' },
            { '/': '/v/*', comment: 'Public vault lookbooks' },
          ],
        },
      ],
    },
    webcredentials: {
      apps: [`${teamId}.app.viola.ios`],
    },
  };

  return NextResponse.json(body, {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
}
