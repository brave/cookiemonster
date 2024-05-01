import path from 'path';

export const templateProfilePathForArgs = ({ pathForProfile, disableCookieList }) => {
  let templateProfile = pathForProfile;
  if (templateProfile === undefined) {
    templateProfile = path.join(import.meta.dirname, '..', 'profiles', Boolean(disableCookieList) ? 'ELC_off' : 'ELC_on')
  }
  return templateProfile;
}
