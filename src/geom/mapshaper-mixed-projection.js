/* @requires mapshaper-matrix2d */


function getAlbersUSA(opts) {
  return function() {
    return AlbersNYT(opts || {});
  };
}

function AlbersNYT(opts) {
  var mproj = require('mproj');
  var lcc = mproj.pj_init('+proj=lcc +lon_0=-96 +lat_0=39 +lat_1=33 +lat_2=45');
  var aea = mproj.pj_init('+proj=aea +lon_0=-96 +lat_0=37.5 +lat_1=29.5 +lat_2=45.5');
  var mixed = new MixedProjection(aea)
    .addFrame(lcc, {lam: -152, phi: 63}, {lam: -115, phi: 27}, 6e6, 3e6, 0.31, 29.2) // AK
    .addFrame(lcc, {lam: -157, phi: 20.9}, {lam: -106.6, phi: 28.2}, 3e6, 5e6, 0.9, 40); // HI
  if (opts.PR) {
    mixed.addFrame(lcc, {lam: -66.431, phi: 18.228}, {lam: -76.5, phi: 26.3 }, 1e6, 1e6, 1, -16); // PR
    // mixed.addFrame(lcc, {lam: -66.431, phi: 18.228}, {lam: -93, phi: 28.22 }, 1e6, 1e6, 1, -16) // PR
  }
  return mixed;
}


// A compound projection, consisting of a default projection and one or more rectangular frames
// that are reprojected and/or affine transformed.
// @proj Default projection.
function MixedProjection(proj) {
  var frames = [];
  var mixed = utils.extend({}, proj);
  var mproj = require('mproj');

  // @proj2 projection to use.
  // @ctr1 {lam, phi} center of the frame contents.
  // @ctr2 {lam, phi} geo location to move the frame center
  // @frameWidth Width of the frame in base projection units
  // @frameHeight Height of the frame in base projection units
  // @scale Scale factor; 1 = no scaling.
  // @rotation Rotation in degrees; 0 = no rotation.
  mixed.addFrame = function(proj2, ctr1, ctr2, frameWidth, frameHeight, scale, rotation) {
    var m = new Matrix2D(),
        a2 = proj.a * 2,
        xy1 = toRawXY(ctr1, proj),
        xy2 = toRawXY(ctr2, proj),
        bbox = [xy1.x - frameWidth / a2, xy1.y - frameHeight / a2,
            xy1.x + frameWidth / a2, xy1.y + frameHeight / a2];
    m.rotate(rotation * Math.PI / 180.0, xy1.x, xy1.y);
    m.scale(scale, scale);
    m.transformXY(xy1.x, xy1.y, xy1);
    m.translate(xy2.x - xy1.x, xy2.y - xy1.y);
    frames.push({
      bbox: bbox,
      matrix: m,
      projection: proj2
    });
    return this;
  };

  // convert a latlon position to x,y in earth radii relative to datum origin
  function toRawXY(lp, P) {
    var xy = mproj.pj_fwd_deg(lp, P);
    return {
      x: (xy.x / P.fr_meter - P.x0) / P.a,
      y: (xy.y / P.fr_meter - P.y0) / P.a
    };
  }

  mixed.fwd = function(lp, xy) {
    var lam = lp.lam,
        phi = lp.phi,
        frame, bbox;
    proj.fwd(lp, xy);
    for (var i=0, n=frames.length; i<n; i++) {
      frame = frames[i];
      bbox = frame.bbox;
      if (xy.x >= bbox[0] && xy.x <= bbox[2] && xy.y >= bbox[1] && xy.y <= bbox[3]) {
        // copy lp (some proj functions may modify it)
        frame.projection.fwd({lam: lam, phi: phi}, xy);
        frame.matrix.transformXY(xy.x, xy.y, xy);
        break;
      }
    }
  };

  return mixed;
}
