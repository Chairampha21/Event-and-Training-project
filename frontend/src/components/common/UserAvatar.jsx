import React from 'react';
import { initials } from '../../utils/initials';

/**
 * The person's profile picture, or their initials when they have none.
 * `className` carries the size and colour (up-av, pf-avatar, avatar ...).
 */
export default function UserAvatar({ name, avatar, className = '', fallback }) {
  if (avatar) {
    return <div className={`${className} has-photo`}><img src={avatar} alt="" /></div>;
  }
  return <div className={className}>{initials(name) || fallback || <i className="ti ti-user" />}</div>;
}
