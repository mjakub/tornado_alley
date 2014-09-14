// next line is to allow globals from included libs, to satisfy jslint program
/*global $: false, mat4: false, vec3: false, requestAnimationFrame: false, Float32Array: false */

function initWebGL(canvas) {
    "use strict";
    var gl = null,
        msg = "Your browser does not support WebGL, or it is not enabled by default.";
    try {
        gl = canvas.getContext("experimental-webgl");
    } catch (e) {
        try {
            gl = canvas.getContext("webgl");
        } catch (f) {
            msg = "Error creating WebGL Context!: " + f.toString();
        }
    }

    if (!gl) {
        alert(msg);
        throw new Error(msg);
    }
    return gl;
}

var projectionMatrix, modelViewMatrix, rotationAxis;

var initMatrices = function (canvas) {
    "use strict";

    // Create a model view matrix with object at 0, 0, -8
    modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -8]);

    // Create a project matrix with 45 degree field of view
    projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 1, 10000);

    rotationAxis = vec3.create();
    vec3.normalize(rotationAxis, [0, 1, 0]);
};

var create_tornado_display_list = function (gl, tornado_points) {
    "use strict";
    // create points, randomly distributed in a cylinder
    // Vertex Data
    var points = [],
        vi = 0,
        cylinder_radius = 1.0,
        cylinder_height = 6.0,
        x,
        y,
        z,
        theta,
        radial,
        twopi = 2 * Math.PI,
        tapering,
        vertical_random;

    while (vi < tornado_points.num_items) {
        // pick a y (vertical) value
        vertical_random = Math.random();
        y = cylinder_height * (vertical_random - 0.5);
        //increase width as z increases
        tapering = 1.0 + 0.5 * vertical_random;
        // pick an angle theta
        theta = Math.random() * twopi;
        // pick a radial
        // to taper, make increase with Y value
        // the 0.2 makes the center hollow.
        radial = tapering * (0.2 + Math.random() * cylinder_radius);

        x = radial * Math.sin(theta);
        z = radial * Math.cos(theta);

        points.push(x);
        points.push(y);
        points.push(z);
        vi += 1;
    }

    // allocate memory for a display list, copy "points" into it,
    // use the list for the current ARRAY_BUFFER
    // (which is bound to variable tornado_points)
    // in practice this copies display list down into graphics hardware.
    gl.bindBuffer(gl.ARRAY_BUFFER, tornado_points);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

    return;
};



var createShader = function (gl, str, type) {
    "use strict";

    var shader;
    if (type === "fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (type === "vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
};

var vertexShaderSourcePoints =
    "    attribute vec3 vertexPos;\n" +
    "    uniform mat4 modelViewMatrix;\n" +
    "    uniform mat4 projectionMatrix;\n" +
    "    void main(void) {\n" +
    "        // Return the transformed and projected vertex value\n" +
    "        gl_Position = projectionMatrix * modelViewMatrix * \n" +
    "            vec4(vertexPos, 1.0);\n" +
    "        gl_PointSize = 1.5;\n" +
    "    }\n";


var fragmentShaderSourcePoints = "    precision mediump float;\n" +
    "    void main(void) {\n" +
    "    gl_FragColor = vec4(0.6, 0.6, 0.4, 1.0);\n" +
    "}\n";


var shaderProgram, shaderVertexPositionAttribute,
    shaderProjectionMatrixUniform, shaderModelViewMatrixUniform;

var initShader = function (gl) {
    "use strict";

    // load and compile the fragment and vertex shader
    //var fragmentShader = getShader(gl, "fragmentShader");
    //var vertexShader = getShader(gl, "vertexShader");
    var fragmentShader = createShader(gl, fragmentShaderSourcePoints, "fragment"),
        vertexShader = createShader(gl, vertexShaderSourcePoints, "vertex");

    // link them together into a new program
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // get pointers to the shader params
    shaderVertexPositionAttribute = gl.getAttribLocation(shaderProgram, "vertexPos");
    gl.enableVertexAttribArray(shaderVertexPositionAttribute);

    shaderProjectionMatrixUniform = gl.getUniformLocation(shaderProgram, "projectionMatrix");
    shaderModelViewMatrixUniform = gl.getUniformLocation(shaderProgram, "modelViewMatrix");


    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }
};

var draw = function (gl, obj) {
    "use strict";
    var mask;

    // clear the background (with black)
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    mask = gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT; // intentional not using bitwise or
    gl.clear(mask);

    // set the shader to use
    gl.useProgram(shaderProgram);

    // connect up the shader parameters: vertex position, color and projection/model matrices
    // set up the buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, obj);

    gl.vertexAttribPointer(shaderVertexPositionAttribute, obj.item_size, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(shaderProjectionMatrixUniform, false, projectionMatrix);
    gl.uniformMatrix4fv(shaderModelViewMatrixUniform, false, modelViewMatrix);

    // draw the object
    gl.drawArrays(gl.Points, 0, obj.num_items);
};


var resetstats_flag = false;
var spinrate_control_element;
var resizeEventThisFrame = false;
var resizeEventPreviousFrame = false;
var numpoints_control_element;
var aspectRatio = 480 / 640;
var tornado_points;

var fps_element;
var minfps_element;
var timeof_minfps_element;

var animate = function (deltat_ms) {
    "use strict";
    var spinrate = 0.2,
        fract,
        angle;

    if (spinrate_control_element !== undefined) {
        spinrate = spinrate_control_element.value / 1000.0;
    }
    //console.log("spinrate = " + spinrate);
    fract = (deltat_ms / 1000.0) * spinrate;
    angle = Math.PI * 2 * fract;
    mat4.rotate(modelViewMatrix, modelViewMatrix, angle, rotationAxis);
};

// make the run function be a closure so it can have private variables
var run = (function () {
    "use strict";
    
    // private variables
    var num_points = 10000,
        max_deltat  = 1,
        walltime_of_max_deltat = 0,
        min_fps = 0.01,
        stats_timestamp = 0,
        prevTime = Date.now(),
        startTime = Date.now();

    
    return function (gl, primlist, canvas) {
        var new_numpoints,
            num_points_changed,
            now = Date.now(),
            deltat,
            resizeEventNeedsHandling = false;

        if (resetstats_flag) {
            walltime_of_max_deltat = 0;
            min_fps = 0.01;
            max_deltat = 1;    //restarts accumlation    
            resetstats_flag = false;
        }

        requestAnimationFrame(function () { run(gl, primlist, canvas); });

        if (!resizeEventThisFrame) {
            resizeEventNeedsHandling  = resizeEventNeedsHandling || resizeEventPreviousFrame;
        }
        resizeEventPreviousFrame = resizeEventThisFrame;
        resizeEventThisFrame = false; //only set by resize event

        if (resizeEventNeedsHandling) {
            //console.log("calling viewport() for resizing");
            canvas.width = window.innerWidth;
            canvas.height = Math.floor(aspectRatio * window.innerWidth);
            gl.viewport(0, 0, canvas.width, canvas.height);
            initMatrices(canvas);
        }
        new_numpoints = numpoints_control_element.value;
        num_points_changed = (num_points !== new_numpoints);
        num_points = new_numpoints;

        if (num_points_changed || resizeEventNeedsHandling) {
            num_points_changed = false;
            //console.log("changed numpoints to " + num_points.toString());
            tornado_points.num_items = num_points;
            tornado_points.item_size = 3;  // 3 floats per point
            tornado_points.primtype = gl.POINTS;
            create_tornado_display_list(gl, tornado_points);
        }
        draw(gl, tornado_points);

        deltat = now - prevTime;
        prevTime = now;
        if (deltat !== undefined) {
            animate(deltat);
        } else {
            deltat = 0;
        }

        //  stats display
        if (deltat > max_deltat) {
            max_deltat = deltat;
            walltime_of_max_deltat = prevTime;
            min_fps = 1000 / deltat;
        }

        if (deltat === 0) {
            deltat = 1000 / 60;
        }
        // Wait at least .2 seconds before refreshing stats display
        if ((prevTime - stats_timestamp) > 500) {
            fps_element.innerHTML = "fps " + (1000 / deltat).toFixed(2);
            minfps_element.innerHTML = ", minfps " + (min_fps).toFixed(2);
            timeof_minfps_element.innerHTML = ", minfps_time " + ((walltime_of_max_deltat - startTime) / 1000).toFixed(3);
            stats_timestamp = prevTime;
        }
    };
})();
    





$(document).ready(

    function () {
        "use strict";
        var gl, canvas,
            spinrate_value_element = document.getElementById("spinrate_display_value"),
            numpoints_display_element = document.getElementById("numpoints_display_value");

        document.getElementById("resetstats").onclick = function () {  // an evt is passed as a param, but not using it
            resetstats_flag = true;
        };
        
        spinrate_control_element = document.getElementById("spinrate_control");
        spinrate_control_element.onchange = function () {
            var newvalue = spinrate_control_element.value;
            if ((newvalue !== undefined) && (newvalue !== null)) {
                spinrate_value_element.innerHTML = (newvalue / 1000.0).toString() + " revs/sec";
            } else {
                spinrate_value_element.innerHTML = "undefined";
            }
        };

        spinrate_control_element.onchange();  // sync spinrate display on reload

        numpoints_control_element = document.getElementById("numpoints_control");
        numpoints_control_element.onchange = function () {
            var newvalue = numpoints_control_element.value;
            if ((newvalue !== undefined) && (newvalue !== null)) {
                numpoints_display_element.innerHTML = newvalue.toString() + " points";
            } else {
                numpoints_display_element.innerHTML = "undefined";
            }
        };
        
        numpoints_control_element.onchange();  // sync spinrate display on reload

        window.addEventListener('resize', function () {
            resizeEventThisFrame = true;
        });

        fps_element = document.getElementById("fps");
        minfps_element = document.getElementById("minfps");
        timeof_minfps_element = document.getElementById("timeof_minfps");

        canvas = document.getElementById("webglcanvas");

        if (window.innerWidth) {
            canvas.width = window.innerWidth;
            canvas.height = Math.floor(aspectRatio * window.innerWidth);
        }

        gl = initWebGL(canvas);
        gl.viewport(0, 0, canvas.width, canvas.height);
        initMatrices(canvas);

        tornado_points = gl.createBuffer();
        tornado_points.num_items = 10000;
        tornado_points.item_size = 3;  // 3 floats per point
        tornado_points.primtype = gl.POINTS;

        //write tornado points list to the currently bound ARRAY_BUFFER
        // next call modifies "debris_list"
        create_tornado_display_list(gl, tornado_points);

        initShader(gl);

        run(gl, tornado_points, canvas);

    }
);

