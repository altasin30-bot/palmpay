"""Pluggable scanner boundary. Demo data is not a biometric identity proof."""
import math, random
class ScannerUnavailable(Exception): pass
class SimulatedScanner:
    def capture(self, mode, selected_template):
        if mode == 'poor_lighting': return None, 'poor_lighting'
        if mode == 'unrecognized': return [random.uniform(-1,1) for _ in selected_template], 'ok'
        if mode == 'success': return [x+random.uniform(-0.05,0.05) for x in selected_template], 'ok'
        raise ValueError('Unsupported scan mode')
class RealScanner:
    def capture(self, mode, selected_template):
        raise ScannerUnavailable('Real scanner is not connected; payment disabled')
def get_scanner(mode):
    if mode=='demo': return SimulatedScanner()
    if mode=='real': return RealScanner()
    raise ScannerUnavailable('Unknown scanner mode')
def similarity(a,b):
    dot=sum(x*y for x,y in zip(a,b)); norm=math.sqrt(sum(x*x for x in a)*sum(y*y for y in b))
    return dot/norm if norm else 0.0
