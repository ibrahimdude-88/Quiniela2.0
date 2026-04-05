const thirdPlaceSlots = [
  '3ABCDF', '3CDFGH', '3CEFHI', '3EHIJK', 
  '3BEFIJ', '3AEHIJ', '3EFGIJ', '3DEIJL'
];

const q3Teams = [
  { code: 'TA', group: 'A' },
  { code: 'TB', group: 'B' },
  { code: 'TC', group: 'C' },
  { code: 'TD', group: 'D' },
  { code: 'TE', group: 'E' },
  { code: 'TF', group: 'F' },
  { code: 'TG', group: 'G' },
  { code: 'TH', group: 'H' }
];

function solveThirdPlaces(slotIndex, currentAssignment, usedTeams) {
    if (slotIndex >= thirdPlaceSlots.length) {
        return currentAssignment;
    }
    const slot = thirdPlaceSlots[slotIndex];
    const allowedGroups = slot.substring(1).split('');
    
    for (let i = 0; i < q3Teams.length; i++) {
        const team = q3Teams[i];
        if (!usedTeams.has(team.code) && allowedGroups.includes(team.group)) {
            usedTeams.add(team.code);
            currentAssignment[slot] = team.code;
            const res = solveThirdPlaces(slotIndex + 1, currentAssignment, usedTeams);
            if (res) return res;
            usedTeams.delete(team.code);
            delete currentAssignment[slot];
        }
    }
    return null; // backtrack
}

console.log(solveThirdPlaces(0, {}, new Set()));
