"""
GeoCatalyst Backend Server
Flask + Firebase Admin SDK + Razorpay + Cloudflare Stream
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
import firebase_admin
from firebase_admin import credentials, auth, firestore, storage
import razorpay
import requests
import os
from datetime import datetime, timedelta
from functools import wraps
import hmac
import hashlib
import json

# ============================================
# FLASK APP INITIALIZATION
# ============================================

app = Flask(__name__)

# --- NEW/UPDATED CORS CONFIGURATION ---
# Define allowed origins (replace with your actual frontend URL if different)
allowed_origins = [
    "https://fluffy-fortnight-v6j6w9x4px9cxpp7-5501.app.github.dev",  # Codespaces development
    "http://localhost:5501",  # Local testing
    "http://127.0.0.1:5501",  # Local testing
    "https://geocatalyst-production.web.app",  # Firebase production
    "https://geocatalyst-production.firebaseapp.com"  # Firebase alternative URL
]

# Apply CORS settings explicitly
CORS(app,
     origins=allowed_origins, # Allow specific origins
     supports_credentials=True, # Allow cookies/auth headers
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], # Allow needed methods
     allow_headers=["Content-Type", "Authorization"] # IMPORTANT: Allow Authorization header
)
# --- END NEW CORS CONFIGURATION ---

# ============================================
# CONFIGURATION
# ============================================

# Razorpay Configuration
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', 'your_razorpay_key_id')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', 'your_razorpay_key_secret')

# Cloudflare Stream Configuration
CLOUDFLARE_ACCOUNT_ID = os.environ.get('CLOUDFLARE_ACCOUNT_ID', 'your_account_id')
CLOUDFLARE_API_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN', 'your_api_token')

# Course Pricing (matching frontend exactly)
COURSE_PRICES = {
    'Remote Sensing': 1000,
    'Geographic Information System (GIS)': 1000,
    'Image Processing': 1250,
    'Global Positioning System (GPS)': 750,
    'Surveying': 1250,
    'Engineering Mathematics': 750,
    'General Aptitude': 500,
    'Test Series Only': 1250,
    'Master Package': 5499
}

# ============================================
# FIREBASE INITIALIZATION
# ============================================

# Check if credentials are in environment variable (Render deployment)
FIREBASE_CREDENTIALS = os.environ.get('FIREBASE_CREDENTIALS')

try:
    if FIREBASE_CREDENTIALS:
        # Production: Credentials are in environment variable
        import json
        credentials_dict = json.loads(FIREBASE_CREDENTIALS)
        cred = credentials.Certificate(credentials_dict)
        print("✅ Using Firebase credentials from environment variable")
    else:
        # Development: Credentials are in file
        FIREBASE_CREDENTIALS_PATH = os.environ.get('FIREBASE_CREDENTIALS_PATH', 'firebase-admin-key.json')
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        print(f"✅ Using Firebase credentials from file: {FIREBASE_CREDENTIALS_PATH}")
    
    # Initialize Firebase with the credentials
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'geocatalyst-production.firebasestorage.app'
    })
    db = firestore.client()
    bucket = storage.bucket()
    print("✅ Firebase Admin SDK initialized successfully")
except Exception as e:
    print(f"⚠️ Firebase initialization error: {e}")
    db = None
    bucket = None

# ============================================
# RAZORPAY INITIALIZATION
# ============================================

try:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    print("✅ Razorpay client initialized successfully")
except Exception as e:
    print(f"⚠️ Razorpay initialization error: {e}")
    razorpay_client = None

# ============================================
# AUTHENTICATION MIDDLEWARE
# ============================================

def verify_firebase_token(f):
    """Decorator to verify Firebase ID token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):

        # --- ADD THIS CHECK ---
        if request.method == 'OPTIONS':
             # Allow preflight requests to pass through without token check
             # The CORS headers will be added by Flask-CORS
             return f(*args, **kwargs)
        # --- END ADDED CHECK ---

        id_token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                id_token = auth_header.split('Bearer ')[1]
        
        if not id_token:
            return jsonify({'error': 'No token provided'}), 401
        
        try:
            # Verify the token
            decoded_token = auth.verify_id_token(id_token)
            request.user_id = decoded_token['uid']
            request.user_email = decoded_token.get('email')
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
    
    return decorated_function

# ============================================
# USER MANAGEMENT ENDPOINTS
# ============================================

@app.route('/api/user/create', methods=['POST'])
def create_user():
    """Create a new user in Firestore after signup"""
    try:
        data = request.get_json()
        user_id = data.get('uid')
        email = data.get('email')
        name = data.get('name')
        phone = data.get('phone')
        
        if not all([user_id, email, name]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Create user document in Firestore
        user_data = {
            'uid': user_id,
            'email': email,
            'name': name,
            'phone': phone or '',
            'plan': 'free',
            'enrolledCourses': [],
            'createdAt': datetime.now(),
            'updatedAt': datetime.now(),
            'stats': {
                'videosWatched': 0,
                'testsAttempted': 0,
                'doubtsAsked': 0,
                'progress': 0,
                'totalPercentageSum': 0, # <-- ADD THIS
                'avgScore': 0             # <-- ADD THIS
            }
        }
        
        db.collection('users').document(user_id).set(user_data)
        
        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'data': user_data
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile', methods=['GET'])
@verify_firebase_token
def get_user_profile():
    """Get user profile data"""
    try:
        user_id = request.user_id
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        return jsonify({
            'success': True,
            'data': user_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile', methods=['PUT'])
@verify_firebase_token
def update_user_profile():
    """Update user profile"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Only allow updating specific fields
        allowed_fields = ['name', 'phone', 'photoURL']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        update_data['updatedAt'] = datetime.now()
        
        db.collection('users').document(user_id).update(update_data)
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# COURSE & CONTENT ENDPOINTS
# ============================================

@app.route('/api/courses', methods=['GET'])
@verify_firebase_token
def get_courses():
    """Get all courses with user's enrollment status"""
    try:
        user_id = request.user_id
        
        # Get user's enrolled courses
        user_doc = db.collection('users').document(user_id).get()
        enrolled_courses = user_doc.to_dict().get('enrolledCourses', []) if user_doc.exists else []
        
        # Get all courses
        courses_ref = db.collection('courses')
        courses = []
        
        for doc in courses_ref.stream():
            course_data = doc.to_dict()
            course_data['id'] = doc.id
            course_data['enrolled'] = doc.id in enrolled_courses
            courses.append(course_data)
        
        return jsonify({
            'success': True,
            'data': courses
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/courses/<course_id>/lectures', methods=['GET'])
@verify_firebase_token
def get_course_lectures(course_id):
    """Get lectures for a specific course"""
    try:
        user_id = request.user_id
        
        # Check if user has access to this course
        user_doc = db.collection('users').document(user_id).get()
        enrolled_courses = user_doc.to_dict().get('enrolledCourses', []) if user_doc.exists else []
        user_plan = user_doc.to_dict().get('plan', 'free') if user_doc.exists else 'free'
        
        # Get lectures
        lectures_ref = db.collection('courses').document(course_id).collection('lectures')
        lectures = []
        
        for doc in lectures_ref.order_by('order').stream():
            lecture_data = doc.to_dict()
            lecture_data['id'] = doc.id
            
            # Check access: free lectures OR user enrolled OR premium plan
            is_free = lecture_data.get('isFree', False)
            is_enrolled = course_id in enrolled_courses
            is_premium = user_plan in ['premium', 'master']
            
            lecture_data['hasAccess'] = is_free or is_enrolled or is_premium
            
            # Don't send YouTube data if no access
            if not lecture_data['hasAccess']:
                lecture_data['youtubeId'] = None
                lecture_data['youtubeUrl'] = None
            else:
                # Ensure YouTube data is present
                lecture_data['youtubeId'] = lecture_data.get('youtubeId', None)
                lecture_data['youtubeUrl'] = lecture_data.get('youtubeUrl', None)
            
            lectures.append(lecture_data)
        
        return jsonify({
            'success': True,
            'data': lectures
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/materials', methods=['GET'])
@verify_firebase_token
def get_study_materials():
    """Get study materials"""
    try:
        user_id = request.user_id
        subject = request.args.get('subject')
        
        # Get user's enrolled courses
        user_doc = db.collection('users').document(user_id).get()
        enrolled_courses = user_doc.to_dict().get('enrolledCourses', []) if user_doc.exists else []
        user_plan = user_doc.to_dict().get('plan', 'free') if user_doc.exists else 'free'
        
        # Query materials
        materials_ref = db.collection('materials')
        
        if subject:
            materials_ref = materials_ref.where('subject', '==', subject)
        
        materials = []
        for doc in materials_ref.stream():
            material_data = doc.to_dict()
            material_data['id'] = doc.id
            
            # Check access
            is_free = material_data.get('access') == 'free'
            material_subject = material_data.get('subject', '')
            is_enrolled = material_subject in enrolled_courses
            is_premium = user_plan in ['premium', 'master']
            
            material_data['hasAccess'] = is_free or is_enrolled or is_premium
            
            # Don't send download URL if no access
            if not material_data['hasAccess']:
                material_data['downloadURL'] = None
            
            materials.append(material_data)
        
        return jsonify({
            'success': True,
            'data': materials
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/material/<material_id>/download', methods=['GET'])
@verify_firebase_token # Make sure this decorator is correctly applied
def get_material_download_url(material_id):
    """
    Generates a short-lived signed URL for a file in Firebase Storage.
    """
    if not bucket: # Add check in case initialization failed
         print("❌ Storage bucket not initialized!")
         return jsonify({'error': 'Storage service unavailable'}), 503

    try:
        # 1. Get the material document from Firestore
        material_doc_ref = db.collection('materials').document(material_id)
        material_doc = material_doc_ref.get()

        if not material_doc.exists:
            print(f"❌ Material document not found in Firestore: {material_id}")
            return jsonify({'error': 'Material record not found'}), 404 # Specific error

        material_data = material_doc.to_dict()

        # --- ACCESS CHECK (Crucial!) ---
        # You need to verify if the user actually has access before generating the URL
        user_id = request.user_id # Get user ID from the decorator
        user_doc_for_access = db.collection('users').document(user_id).get()
        user_data_for_access = user_doc_for_access.to_dict() if user_doc_for_access.exists else {}
        enrolled_courses_for_access = user_data_for_access.get('enrolledCourses', [])
        user_plan_for_access = user_data_for_access.get('plan', 'free')

        is_free = material_data.get('access') == 'free'
        material_subject = material_data.get('subject', '')
        is_enrolled = material_subject in enrolled_courses_for_access
        is_premium_plan = user_plan_for_access in ['premium', 'master'] # Adjust plan names if needed

        has_access = is_free or is_enrolled or is_premium_plan
        if not has_access:
             print(f"❌ Access denied for user {user_id} to material {material_id} (Subject: {material_subject})")
             return jsonify({'error': 'Access denied to this material'}), 403
        # --- END ACCESS CHECK ---


        # 2. Get the filename from the 'storageUrl' (preferred) or 'filename' field
        #    Use storageUrl as it contains the folder path
        storage_path = material_data.get('storageUrl')

        if not storage_path:
             # Fallback to filename if storageUrl is missing (less ideal)
             filename_only = material_data.get('filename')
             if filename_only:
                 storage_path = f"materials/{filename_only}" # Assuming it's always in the 'materials' folder
                 print(f"⚠️ Warning: Using fallback storage path construction for material {material_id}: {storage_path}")
             else:
                print(f"❌ File path ('storageUrl' or 'filename') missing in Firestore record: {material_id}")
                return jsonify({'error': 'File path missing in material record'}), 404 # Specific error

        print(f"ℹ️ Attempting to access Storage path: {storage_path}")

        # 3. Get the blob from Firebase Storage
        blob = bucket.blob(storage_path) # Use the full path

        if not blob.exists():
            print(f"❌ File does not exist in Storage at path: {storage_path} (Material ID: {material_id})")
            return jsonify({'error': 'File does not exist in storage'}), 404 # Specific error

        # 4. Generate a signed URL (valid for 15 minutes)
        try:
            download_url = blob.generate_signed_url(
                expiration=timedelta(minutes=15),
                method='GET'
            )
            print(f"✅ Generated signed URL for: {storage_path}")
        except Exception as sign_e:
             print(f"❌ Error generating signed URL for {storage_path}: {sign_e}")
             # This might happen due to permissions issues with the service account
             return jsonify({'error': 'Could not generate download link', 'details': str(sign_e)}), 500


        # --- ADD DOWNLOAD COUNT INCREMENT ---
        try:
            material_doc_ref.update({'downloads': firestore.Increment(1)})
            print(f"📈 Incremented download count for material {material_id}")
        except Exception as update_e:
            print(f"⚠️ Failed to increment download count for {material_id}: {update_e}")
        # --- END DOWNLOAD COUNT ---

        # 5. Return the URL to the frontend
        return jsonify({
            'success': True,
            'data': {
                'downloadUrl': download_url
            }
        }), 200

    except Exception as e:
        print(f"❌ Unexpected error in get_material_download_url for {material_id}: {e}")
        import traceback
        traceback.print_exc() # Print full traceback for debugging
        return jsonify({'error': 'Failed to get download URL', 'details': str(e)}), 500

@app.route('/api/tests', methods=['GET'])
@verify_firebase_token
def get_student_tests():
    """Get practice tests visible to the current student."""
    try:
        user_id = request.user_id
        subject_filter = request.args.get('subject')
        type_filter = request.args.get('type')

        print(f"\n{'='*60}")
        print(f"📋 GET TESTS REQUEST")
        print(f"User ID: {user_id}")
        print(f"Subject Filter: {subject_filter}")
        print(f"{'='*60}\n")

        # --- Get User Data ---
        user_doc_ref = db.collection('users').document(user_id)
        user_doc = user_doc_ref.get()
        
        if not user_doc.exists:
            print(f"❌ User document not found for UID: {user_id}")
            return jsonify({'error': 'User profile not found'}), 404

        user_data = user_doc.to_dict()
        enrolled_courses = user_data.get('enrolledCourses', [])
        user_plan = user_data.get('plan', 'free')

        print(f"👤 USER DATA:")
        print(f"   Plan: {user_plan}")
        print(f"   Enrolled Courses: {enrolled_courses}")
        print(f"   User UID: {user_data.get('uid')}")

        # --- Query Tests ---
        tests_query = db.collection('tests').where('isActive', '==', True)

        if subject_filter:
            tests_query = tests_query.where('subject', '==', subject_filter)

        tests_list = []
        for doc in tests_query.stream():
            test_data = doc.to_dict()
            test_data['id'] = doc.id

            print(f"\n📝 PROCESSING TEST: {test_data.get('name', 'Untitled')}")
            print(f"   Test ID: {doc.id}")
            print(f"   Subject: {test_data.get('subject', 'N/A')}")
            print(f"   Access Level: {test_data.get('access', 'premium')}")

            # --- Check Admin Grants FIRST ---
            has_grant = False
            try:
                print(f"   🔍 Checking testAccessGrants collection...")
                grants_query = db.collection('testAccessGrants') \
                    .where('userId', '==', user_id) \
                    .where('testId', '==', doc.id) \
                    .where('isActive', '==', True) \
                    .limit(1)
                
                grants = list(grants_query.stream())
                
                if grants:
                    has_grant = True
                    grant_doc = grants[0]
                    grant_data = grant_doc.to_dict()
                    print(f"   ✅ GRANT FOUND!")
                    print(f"      Grant ID: {grant_doc.id}")
                    print(f"      Grant Data: {grant_data}")
                else:
                    print(f"   ℹ️ No grants found")
                    
            except Exception as grant_e:
                print(f"   ⚠️ Error checking grants: {grant_e}")
                import traceback
                traceback.print_exc()

            # --- Check Other Access Methods ---
            test_subject = test_data.get('subject', '')
            test_access_level = test_data.get('access', 'premium')

            is_free_test = test_access_level == 'free'
            is_enrolled_in_subject = test_subject in enrolled_courses
            has_test_series = 'Test Series Only' in enrolled_courses
            has_master_plan = user_plan == 'master'

            print(f"   📊 ACCESS CHECKS:")
            print(f"      Admin Grant: {has_grant}")
            print(f"      Free Test: {is_free_test}")
            print(f"      Enrolled in Subject: {is_enrolled_in_subject}")
            print(f"      Has Test Series: {has_test_series}")
            print(f"      Master Plan: {has_master_plan}")

            # Determine final access
            has_access = (
                has_grant or
                is_free_test or
                is_enrolled_in_subject or
                has_test_series or
                has_master_plan
            )

            print(f"   🎯 FINAL ACCESS: {has_access}")

            # Prepare summary
            test_summary = {
                'id': test_data['id'],
                'title': test_data.get('name', 'Untitled Test'),
                'subject': test_subject,
                'type': test_data.get('type', 'practice'),
                'duration': test_data.get('duration', 0),
                'totalQuestions': len(test_data.get('questions', [])),
                'totalMarks': test_data.get('totalMarks', 0),
                'access': test_access_level,
                'hasAccess': has_access
            }
            tests_list.append(test_summary)

        print(f"\n{'='*60}")
        print(f"✅ RETURNING {len(tests_list)} TESTS")
        print(f"{'='*60}\n")

        return jsonify({
            'success': True,
            'data': tests_list
        }), 200

    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ ERROR IN get_student_tests:")
        print(f"   {str(e)}")
        print(f"{'='*60}\n")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch tests', 'details': str(e)}), 500

# @app.route('/api/tests', methods=['GET'])
# @verify_firebase_token
# def get_tests():
#     """Get practice tests"""
#     try:
#         user_id = request.user_id
#         subject = request.args.get('subject')
#         test_type = request.args.get('type')  # free, subject, mock
        
#         # Get user data
#         user_doc = db.collection('users').document(user_id).get()
#         enrolled_courses = user_doc.to_dict().get('enrolledCourses', []) if user_doc.exists else []
#         user_plan = user_doc.to_dict().get('plan', 'free') if user_doc.exists else 'free'
        
#         # Query tests
#         tests_ref = db.collection('tests')
        
#         if subject:
#             tests_ref = tests_ref.where('subject', '==', subject)
        
#         if test_type:
#             tests_ref = tests_ref.where('type', '==', test_type)
        
#         tests = []
#         for doc in tests_ref.stream():
#             test_data = doc.to_dict()
#             test_data['id'] = doc.id
            
#             # Check access
#             is_free = test_data.get('isFree', False)
#             test_subject = test_data.get('subject', '')
#             is_enrolled = test_subject in enrolled_courses
#             has_test_series = 'Test Series Only' in enrolled_courses
#             is_premium = user_plan in ['premium', 'master']
            
#             test_data['hasAccess'] = is_free or is_enrolled or has_test_series or is_premium
            
#             tests.append(test_data)
        
#         return jsonify({
#             'success': True,
#             'data': tests
#         }), 200
        
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500

# Add this import if you don't have it
import traceback

# --- Add or Verify this Helper Function ---
def check_user_access(user_data, content_subject, content_access='premium', is_test=False, test_id=None):
    """
    ✅ FEATURE 2: NOW CHECKS testAccessGrants COLLECTION
    
    Checks if a user has access to specific content (course, material, or test).
    
    Args:
        user_data: User document data
        content_subject: Subject/course name
        content_access: 'free' or 'premium'
        is_test: True if checking test access
        test_id: Test document ID (required if is_test=True)
    
    Returns:
        bool: True if user has access, False otherwise
    """
    if not user_data:
        return False

    # Free content is accessible to everyone
    if content_access == 'free':
        return True

    # ✅ FEATURE 2: Check test-specific grants FIRST
    if is_test and test_id:
        try:
            user_id = user_data.get('uid')
            grants_query = db.collection('testAccessGrants') \
                .where('userId', '==', user_id) \
                .where('testId', '==', test_id) \
                .where('isActive', '==', True) \
                .limit(1)
            
            grants = list(grants_query.stream())
            
            if grants:
                print(f"✅ User {user_id} has admin-granted access to test {test_id}")
                return True
            else:
                print(f"ℹ️ No grants found for user {user_id} on test {test_id}")
                
        except Exception as grant_e:
            print(f"⚠️ Error checking test grants: {grant_e}")
            import traceback
            traceback.print_exc()

    # Check master plan
    user_plan = user_data.get('plan', 'free')
    if user_plan == 'master':
        return True

    # Check enrolled courses
    enrolled_courses = user_data.get('enrolledCourses', [])
    if content_subject in enrolled_courses:
        return True

    # Check test series access for tests
    if is_test and 'Test Series Only' in enrolled_courses:
        return True

    return False


@app.route('/api/debug/grants/<user_id>', methods=['GET'])
@verify_firebase_token
def debug_user_grants(user_id):
    """Debug endpoint to check all grants for a user"""
    try:
        # Verify requesting user is admin or same user
        requesting_user = request.user_id
        
        # Get all grants for this user
        grants_query = db.collection('testAccessGrants').where('userId', '==', user_id)
        grants = []
        
        for doc in grants_query.stream():
            grant_data = doc.to_dict()
            grant_data['id'] = doc.id
            
            # Convert timestamps
            if 'grantedAt' in grant_data and hasattr(grant_data['grantedAt'], 'isoformat'):
                grant_data['grantedAt'] = grant_data['grantedAt'].isoformat() + "Z"
            
            grants.append(grant_data)
        
        return jsonify({
            'success': True,
            'data': {
                'userId': user_id,
                'totalGrants': len(grants),
                'grants': grants
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching grants: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================
# 1. GET FULL TEST DETAILS (WITH QUESTIONS)
# ============================================
@app.route('/api/tests/<test_id>', methods=['GET'])
@verify_firebase_token
def get_test_details_with_questions(test_id):
    """Fetches full test details including questions if user has access."""
    try:
        user_id = request.user_id

        # Fetch Test Document
        test_doc_ref = db.collection('tests').document(test_id)
        test_doc = test_doc_ref.get()

        if not test_doc.exists:
            print(f"❌ Test not found in Firestore: {test_id}")
            return jsonify({'error': 'Test not found'}), 404

        test_data = test_doc.to_dict()
        test_data['id'] = test_doc.id

        # Check if Test is Active
        if not test_data.get('isActive', False):
             print(f"⚠️ Access denied for test {test_id}: Test is not active.")
             return jsonify({'error': 'This test is currently inactive.'}), 403

        # Fetch User Data for Access Check
        user_doc_ref = db.collection('users').document(user_id)
        user_doc = user_doc_ref.get()
        if not user_doc.exists:
            print(f"⚠️ User document not found for UID: {user_id}")
            return jsonify({'error': 'User profile not found'}), 404
        user_data = user_doc.to_dict()

        # ✅ FEATURE 2: Perform Access Check WITH test_id parameter
        has_access = check_user_access(
            user_data=user_data,
            content_subject=test_data.get('subject', ''),
            content_access=test_data.get('access', 'premium'),
            is_test=True,
            test_id=test_id  # ✅ NOW PASSING test_id
        )

        if not has_access:
            print(f"🚫 Access denied for user {user_id} to test {test_id}")
            return jsonify({
                'error': 'Access Denied', 
                'message': f'Upgrade needed for {test_data.get("subject", "this test")}.'
            }), 403

        # Access Granted: Return Full Test Data
        test_data.setdefault('questions', [])
        test_data.setdefault('totalMarks', 0)

        # Clean questions before sending
        cleaned_questions = []
        for q in test_data['questions']:
            cleaned_q = {
                'type': q.get('type'),
                'question': q.get('question'),
                'options': q.get('options'),
                'marks': q.get('marks'),
                'negativeMarks': q.get('negativeMarks'),
                'markValue': q.get('markValue'),
                'imageUrl': q.get('imageUrl')
            }
            cleaned_questions.append(cleaned_q)
        test_data['questions'] = cleaned_questions

        print(f"✅ Access granted for user {user_id} to test {test_id}")
        return jsonify({
            'success': True,
            'data': test_data
        }), 200

    except Exception as e:
        print(f"❌ Error fetching test {test_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to load test', 'details': str(e)}), 500

# ============================================
# 2. SUBMIT TEST ANSWERS
# ============================================
@app.route('/api/tests/<test_id>/submit', methods=['POST'])
@verify_firebase_token
def submit_test_attempt(test_id):
    """Receives student answers, evaluates them, and saves the attempt."""
    try:
        user_id = request.user_id
        
        existing_attempt_query = db.collection('testAttempts') \
            .where('userId', '==', user_id) \
            .where('testId', '==', test_id) \
            .limit(1)
        
        existing_attempts = list(existing_attempt_query.stream())
        
        if existing_attempts:
            print(f"🚫 User {user_id} tried to re-submit test {test_id} that was already attempted")
            return jsonify({
                'error': 'You have already attempted this test',
                'code': 'ALREADY_ATTEMPTED'
            }), 403
        
        submission_data = request.get_json()
        student_answers = submission_data.get('answers', {}) # { "0": "A", "1": ["B", "C"], "2": "12.5" }
        time_taken = submission_data.get('timeTaken', 0) # In seconds

        # --- Fetch Correct Test Data (including answers) ---
        test_doc_ref = db.collection('tests').document(test_id)
        test_doc = test_doc_ref.get()

        if not test_doc.exists:
            print(f"❌ Test not found during submission: {test_id}")
            return jsonify({'error': 'Test not found'}), 404

        test_data = test_doc.to_dict()
        questions = test_data.get('questions', [])
        total_test_marks = test_data.get('totalMarks', 0)

        if not questions:
            return jsonify({'error': 'Test has no questions to evaluate'}), 400

        # --- Evaluate Answers ---
        score = 0.0 # Use float for potential fractions
        correct_count = 0
        wrong_count = 0
        unattempted_count = 0
        evaluated_answers = {} # Store evaluation details per question if needed

        for i, q in enumerate(questions):
            q_index_str = str(i) # Answers dict uses string index
            student_answer = student_answers.get(q_index_str)
            q_marks = float(q.get('marks', 0))
            q_negative_marks = float(q.get('negativeMarks', 0))
            q_type = q.get('type')
            is_correct = False

            # Handle unattempted first
            if student_answer is None or student_answer == '':
                unattempted_count += 1
                evaluated_answers[q_index_str] = {'status': 'unattempted'}
                continue

            try:
                if q_type == 'mcq':
                    correct_answer = q.get('correctAnswer') # e.g., "A"
                    if student_answer == correct_answer:
                        is_correct = True
                    else:
                        score -= q_negative_marks
                        wrong_count += 1
                elif q_type == 'msq':
                    correct_answers_set = set(q.get('correctAnswers', [])) # e.g., {"B", "C"}
                    # Ensure student_answer is a list/set before comparison
                    student_answers_list = student_answer if isinstance(student_answer, list) else [student_answer]
                    student_answers_set = set(student_answers_list)
                    # Full marks only if sets are identical
                    if student_answers_set == correct_answers_set and len(student_answers_set) > 0 : # Check not empty
                        is_correct = True
                    else:
                        # MSQ has no negative marking
                        wrong_count += 1 # Any deviation from perfect answer is wrong
                elif q_type == 'numerical':
                    correct_num = float(q.get('correctAnswer', float('inf')))
                    tolerance = float(q.get('tolerance', 0))
                    try:
                        # Convert student answer string to float for comparison
                         student_num = float(student_answer)
                         if abs(student_num - correct_num) <= tolerance:
                            is_correct = True
                         else:
                            # Numerical has no negative marking
                            wrong_count += 1
                    except (ValueError, TypeError):
                         print(f"⚠️ Invalid numerical input '{student_answer}' for Q{i+1}")
                         wrong_count += 1 # Invalid format is wrong
                elif q_type == 'true-false':
                     correct_bool = q.get('correctAnswer') # Should be True or False
                     # Convert submitted string answer ('true'/'false') to boolean
                     student_bool = str(student_answer).lower() == 'true'
                     if student_bool == correct_bool:
                         is_correct = True
                     else:
                        score -= q_negative_marks # Assume T/F has negative marking like MCQ
                        wrong_count += 1
                # Add other question type evaluations here

                # Update score and counts based on evaluation
                if is_correct:
                    score += q_marks
                    correct_count += 1
                    evaluated_answers[q_index_str] = {'status': 'correct'}
                elif q_type not in ['mcq', 'true-false']: # Only add to wrong if not already handled by negative mark logic
                    # wrong_count was already incremented where needed above
                    evaluated_answers[q_index_str] = {'status': 'wrong'}
                else: # MCQ/TF wrong case already handled score/count
                     evaluated_answers[q_index_str] = {'status': 'wrong'}


            except Exception as eval_error:
                 print(f"⚠️ Error evaluating Q{i+1} (type: {q_type}, answer: {student_answer}): {eval_error}")
                 wrong_count += 1 # Mark as wrong if evaluation logic fails
                 evaluated_answers[q_index_str] = {'status': 'error'}

        # Calculate percentage
        percentage = (score / total_test_marks * 100) if total_test_marks > 0 else 0

        # --- Save Attempt to Firestore ('testAttempts' collection) ---
        attempt_data = {
            'userId': user_id,
            'testId': test_id,
            'testTitle': test_data.get('name', 'Test'),
            'subject': test_data.get('subject', ''),
            'score': round(score, 2), # Round final score
            'totalMarks': total_test_marks,
            'percentage': round(percentage, 2),
            'correctAnswers': correct_count,
            'wrongAnswers': wrong_count,
            'unattempted': unattempted_count,
            'timeTaken': time_taken,
            'submittedAt': datetime.now(),
            'answers': student_answers, # Store what the student submitted
            # 'evaluation': evaluated_answers # Optionally store detailed evaluation status
        }
        attempt_ref = db.collection('testAttempts').add(attempt_data)
        print(f"✅ Test attempt saved: {attempt_ref[1].id} for user {user_id} - Score: {score}/{total_test_marks}")

        # --- Update User Stats ---
        @firestore.transactional
        def update_user_stats(transaction, user_ref, new_percentage):
            user_snapshot = user_ref.get(transaction=transaction)
            if not user_snapshot.exists:
                print(f"⚠️ User {user_id} not found, cannot update stats.")
                return

            user_data = user_snapshot.to_dict()
            stats = user_data.get('stats', {})

            # Get current values, default to 0 if not present
            current_attempts = stats.get('testsAttempted', 0)
            current_sum = stats.get('totalPercentageSum', 0)

            # Calculate new values
            new_attempts = current_attempts + 1
            new_sum = current_sum + new_percentage
            new_average = new_sum / new_attempts if new_attempts > 0 else 0

            # Update the stats map
            transaction.update(user_ref, {
                'stats.testsAttempted': new_attempts,
                'stats.totalPercentageSum': new_sum,
                'stats.avgScore': round(new_average, 2), # Store the new average
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            print(f"✅ Updated stats for user {user_id}: AvgScore={new_average:.2f}")

        try:
            user_ref = db.collection('users').document(user_id)
            # Use the new percentage from this attempt
            new_percentage_from_this_test = round(percentage, 2) 
            
            transaction = db.transaction()
            update_user_stats(transaction, user_ref, new_percentage_from_this_test)
            
        except Exception as stat_e:
            print(f"⚠️ Failed to update user stats after test submission: {stat_e}")
        # --- End Update User Stats ---

        # --- Return Result Summary to Frontend ---
        result_summary = {
            'attemptId': attempt_ref[1].id,
            'score': round(score, 2),
            'totalMarks': total_test_marks,
            'percentage': round(percentage, 2),
            'correctAnswers': correct_count,
            'wrongAnswers': wrong_count,
            'unattempted': unattempted_count,
            'timeTaken': time_taken,
        }

        return jsonify({'success': True, 'data': result_summary}), 200

    except Exception as e:
        print(f"❌ Error submitting test {test_id} for user {user_id}: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to submit test attempt', 'details': str(e)}), 500


# ============================================
# 3. GET USER'S TEST ATTEMPTS
# ============================================
@app.route('/api/user/test-attempts', methods=['GET'])
@verify_firebase_token
def get_user_test_attempts():
    """Fetches summaries of the current user's past test attempts."""
    try:
        user_id = request.user_id
        test_id_filter = request.args.get('testId') # Optional filter

        attempts_query = db.collection('testAttempts').where('userId', '==', user_id)

        if test_id_filter:
            attempts_query = attempts_query.where('testId', '==', test_id_filter)

        # Order by submission time, newest first
        attempts_query = attempts_query.order_by('submittedAt', direction=firestore.Query.DESCENDING)

        attempts_list = []
        for doc in attempts_query.stream():
            attempt_data = doc.to_dict()
            # Convert timestamp to ISO string for JSON compatibility
            submitted_at_iso = None
            if 'submittedAt' in attempt_data and hasattr(attempt_data['submittedAt'], 'isoformat'):
                submitted_at_iso = attempt_data['submittedAt'].isoformat() + "Z" # Add Z for UTC

            attempt_summary = {
                'id': doc.id, # Attempt document ID
                'testId': attempt_data.get('testId'),
                'testTitle': attempt_data.get('testTitle', 'Test'),
                'subject': attempt_data.get('subject', ''),
                'score': attempt_data.get('score'),
                'totalMarks': attempt_data.get('totalMarks'),
                'percentage': attempt_data.get('percentage'),
                'submittedAt': submitted_at_iso,
                'correctAnswers': attempt_data.get('correctAnswers'),
                'wrongAnswers': attempt_data.get('wrongAnswers'),
                'unattempted': attempt_data.get('unattempted'),
                'timeTaken': attempt_data.get('timeTaken')
            }
            attempts_list.append(attempt_summary)

        print(f"✅ Fetched {len(attempts_list)} attempt summaries for user {user_id}")

        return jsonify({'success': True, 'data': attempts_list}), 200

    except Exception as e:
        print(f"❌ Error fetching user test attempts for user {user_id}: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch test attempts', 'details': str(e)}), 500


# ============================================
# 4. GET SPECIFIC TEST ATTEMPT RESULT - UPDATED
# ============================================
@app.route('/api/user/test-attempts/<attempt_id>', methods=['GET'])
@verify_firebase_token
def get_specific_test_attempt(attempt_id):
    """Fetches the detailed result of a specific test attempt for review WITH full questions."""
    try:
        user_id = request.user_id

        attempt_doc_ref = db.collection('testAttempts').document(attempt_id)
        attempt_doc = attempt_doc_ref.get()

        if not attempt_doc.exists:
            return jsonify({'error': 'Test attempt not found'}), 404

        attempt_data = attempt_doc.to_dict()

        # Verify ownership
        if attempt_data.get('userId') != user_id:
            print(f"🚫 Access denied: User {user_id} tried to access attempt {attempt_id} belonging to {attempt_data.get('userId')}")
            return jsonify({'error': 'Access denied to this test result'}), 403

        # Convert timestamp
        if 'submittedAt' in attempt_data and hasattr(attempt_data['submittedAt'], 'isoformat'):
             attempt_data['submittedAt'] = attempt_data['submittedAt'].isoformat() + "Z"

        # 🆕 FETCH ORIGINAL TEST WITH FULL QUESTIONS (INCLUDING SOLUTION IMAGES)
        try:
            test_doc_ref = db.collection('tests').document(attempt_data['testId'])
            test_doc = test_doc_ref.get()
            if test_doc.exists:
                original_test_data = test_doc.to_dict()
                
                # 🆕 INCLUDE FULL QUESTIONS WITH CORRECT ANSWERS, EXPLANATIONS, AND SOLUTION IMAGES
                attempt_data['testQuestions'] = original_test_data.get('questions', [])
                
                print(f"✅ Fetched {len(attempt_data['testQuestions'])} questions WITH answers/explanations/images for review")
            else:
                print(f"⚠️ Original test document {attempt_data['testId']} not found for review.")
                attempt_data['testQuestions'] = []
        except Exception as test_fetch_e:
             print(f"⚠️ Could not fetch original test details for attempt review: {test_fetch_e}")
             attempt_data['testQuestions'] = []

        print(f"✅ Fetched detailed attempt {attempt_id} for user {user_id}")
        return jsonify({'success': True, 'data': attempt_data}), 200

    except Exception as e:
        print(f"❌ Error fetching specific test attempt {attempt_id}: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch test result details', 'details': str(e)}), 500

# ============================================
# FEATURE 1: CHECK IF TEST ALREADY ATTEMPTED
# ============================================

@app.route('/api/tests/<test_id>/check-attempt', methods=['GET'])
@verify_firebase_token
def check_test_attempt(test_id):
    """
    Check if the current user has already attempted this specific test.
    Returns: { "attempted": true/false, "attemptData": {...} or null }
    """
    try:
        user_id = request.user_id

        # Query testAttempts collection for this user and test
        attempts_query = db.collection('testAttempts') \
            .where('userId', '==', user_id) \
            .where('testId', '==', test_id) \
            .limit(1)
        
        attempts = list(attempts_query.stream())
        
        if attempts:
            # User has attempted this test
            attempt_doc = attempts[0]
            attempt_data = attempt_doc.to_dict()
            attempt_data['id'] = attempt_doc.id
            
            # Convert timestamp if needed
            if 'submittedAt' in attempt_data and hasattr(attempt_data['submittedAt'], 'isoformat'):
                attempt_data['submittedAt'] = attempt_data['submittedAt'].isoformat() + "Z"
            
            print(f"✅ User {user_id} has already attempted test {test_id}")
            
            return jsonify({
                'success': True,
                'data': {
                    'attempted': True,
                    'attemptData': attempt_data
                }
            }), 200
        else:
            # User has NOT attempted this test
            print(f"ℹ️ User {user_id} has NOT attempted test {test_id}")
            
            return jsonify({
                'success': True,
                'data': {
                    'attempted': False,
                    'attemptData': None
                }
            }), 200

    except Exception as e:
        print(f"❌ Error checking attempt for test {test_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to check attempt status', 'details': str(e)}), 500


@app.route('/api/user/test-attempts', methods=['GET'])
@verify_firebase_token
def get_all_user_attempts():
    """
    Get ALL test attempts for the current user (summary only, no full questions).
    This is used to determine which tests have been attempted.
    Returns: [ { testId, testTitle, score, percentage, submittedAt, ... }, ... ]
    """
    try:
        user_id = request.user_id
        test_id_filter = request.args.get('testId')  # Optional filter

        # Query all attempts by this user
        attempts_query = db.collection('testAttempts').where('userId', '==', user_id)

        if test_id_filter:
            attempts_query = attempts_query.where('testId', '==', test_id_filter)

        # Order by submission time, newest first
        attempts_query = attempts_query.order_by('submittedAt', direction=firestore.Query.DESCENDING)

        attempts_list = []
        for doc in attempts_query.stream():
            attempt_data = doc.to_dict()
            
            # Convert timestamp to ISO string for JSON compatibility
            submitted_at_iso = None
            if 'submittedAt' in attempt_data:
                if hasattr(attempt_data['submittedAt'], 'isoformat'):
                    submitted_at_iso = attempt_data['submittedAt'].isoformat() + "Z"
                elif hasattr(attempt_data['submittedAt'], '_seconds'):
                    from datetime import datetime
                    submitted_at_iso = datetime.fromtimestamp(attempt_data['submittedAt']._seconds).isoformat() + "Z"

            attempt_summary = {
                'id': doc.id,
                'testId': attempt_data.get('testId'),
                'testTitle': attempt_data.get('testTitle', 'Test'),
                'subject': attempt_data.get('subject', ''),
                'score': attempt_data.get('score'),
                'totalMarks': attempt_data.get('totalMarks'),
                'percentage': attempt_data.get('percentage'),
                'submittedAt': submitted_at_iso,
                'correctAnswers': attempt_data.get('correctAnswers'),
                'wrongAnswers': attempt_data.get('wrongAnswers'),
                'unattempted': attempt_data.get('unattempted'),
                'timeTaken': attempt_data.get('timeTaken')
            }
            attempts_list.append(attempt_summary)

        print(f"✅ Fetched {len(attempts_list)} attempt summaries for user {user_id}")

        return jsonify({'success': True, 'data': attempts_list}), 200

    except Exception as e:
        print(f"❌ Error fetching user test attempts: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch test attempts', 'details': str(e)}), 500

# ============================================
# DOUBTS ENDPOINTS
# ============================================

@app.route('/api/doubts', methods=['GET'])
@verify_firebase_token
def get_doubts():
    """Get user's doubts"""
    try:
        user_id = request.user_id
        
        # Get doubts for this user
        doubts_ref = db.collection('doubts').where('userId', '==', user_id).order_by('createdAt', direction=firestore.Query.DESCENDING)
        
        doubts = []
        for doc in doubts_ref.stream():
            doubt_data = doc.to_dict()
            doubt_data['id'] = doc.id
            doubts.append(doubt_data)
        
        return jsonify({
            'success': True,
            'data': doubts
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/doubts', methods=['POST'])
@verify_firebase_token # Assuming you have this decorator
def submit_doubt():
    """Submit a new doubt, creating a conversation log."""
    try:
        user_id = request.user_id
        data = request.get_json()

        subject = data.get('subject')
        question_text = data.get('question')

        if not all([subject, question_text]):
            return jsonify({'error': 'Subject and question are required'}), 400

        # Get User's Name
        user_name = "Student" # Default name
        try:
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                user_name = user_doc.to_dict().get('name', user_doc.to_dict().get('displayName', "Student"))
        except Exception as e:
            print(f"⚠️ Could not fetch user name for {user_id}: {e}")

        # Create Initial Conversation Log Entry
        # --- Use datetime.now() instead of SERVER_TIMESTAMP ---
        initial_message = {
            'senderId': user_id,
            'senderName': user_name,
            'senderType': 'student',
            'text': question_text,
            'timestamp': datetime.now() # <<< CORRECTED
        }
        # --- End Correction ---

        # Create doubt document
        doubt_data = {
            'userId': user_id,
            'userEmail': request.user_email,
            'userName': user_name,
            'subject': subject,
            'conversationLog': [initial_message],
            'status': 'pending',
            # --- Use datetime.now() for consistency and safety ---
            'createdAt': datetime.now(), # <<< CORRECTED
            'updatedAt': datetime.now()  # <<< CORRECTED
            # --- End Correction ---
        }

        # Add the new document to Firestore
        doubt_ref = db.collection('doubts').add(doubt_data)

        # Update user stats (optional)
        try:
            db.collection('users').document(user_id).update({
                'stats.doubtsAsked': firestore.Increment(1)
            })
        except Exception as e:
             print(f"⚠️ Could not update user stats for {user_id}: {e}")

        print(f"✅ Doubt created with conversation log: {doubt_ref[1].id} by {user_name}")

        return jsonify({
            'success': True,
            'message': 'Doubt submitted successfully',
            'doubtId': doubt_ref[1].id
        }), 201

    except Exception as e:
        print(f"❌ Error submitting doubt: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# ============================================
# PAYMENT ENDPOINTS (RAZORPAY)
# ============================================

@app.route('/api/payment/create-order', methods=['POST'])
@verify_firebase_token
def create_payment_order():
    """Create Razorpay order for course purchase"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        course_name = data.get('courseName')
        
        if not course_name:
            return jsonify({'error': 'Course name is required'}), 400
        
        # Get course price
        amount = COURSE_PRICES.get(course_name)
        
        if not amount:
            return jsonify({'error': 'Invalid course'}), 400
        
        # Create Razorpay order
        order_data = {
            'amount': amount * 100,  # Amount in paise
            'currency': 'INR',
            'receipt': f'order_{user_id}_{int(datetime.now().timestamp())}',
            'notes': {
                'userId': user_id,
                'courseName': course_name
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        # Save order to Firestore
        db.collection('orders').document(order['id']).set({
            'orderId': order['id'],
            'userId': user_id,
            'courseName': course_name,
            'amount': amount,
            'currency': 'INR',
            'status': 'created',
            'createdAt': datetime.now()
        })
        
        return jsonify({
            'success': True,
            'data': {
                'orderId': order['id'],
                'amount': amount,
                'currency': 'INR',
                'key': RAZORPAY_KEY_ID
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/payment/verify', methods=['POST'])
@verify_firebase_token
def verify_payment():
    """Verify Razorpay payment and grant course access"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        order_id = data.get('orderId')
        payment_id = data.get('paymentId')
        signature = data.get('signature')
        
        if not all([order_id, payment_id, signature]):
            return jsonify({'error': 'Missing payment details'}), 400
        
        # Verify signature
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            f"{order_id}|{payment_id}".encode(),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != signature:
            return jsonify({'error': 'Invalid payment signature'}), 400
        
        # Get order details
        order_doc = db.collection('orders').document(order_id).get()
        
        if not order_doc.exists:
            return jsonify({'error': 'Order not found'}), 404
        
        order_data = order_doc.to_dict()
        course_name = order_data['courseName']
        
        # Update order status
        db.collection('orders').document(order_id).update({
            'status': 'completed',
            'paymentId': payment_id,
            'signature': signature,
            'completedAt': datetime.now()
        })
        
        # Grant course access to user
        if course_name == 'Master Package':
            # Grant all courses
            all_courses = list(COURSE_PRICES.keys())
            all_courses.remove('Master Package')
            db.collection('users').document(user_id).update({
                'plan': 'master',
                'enrolledCourses': firestore.ArrayUnion(all_courses),
                'updatedAt': datetime.now()
            })
        else:
            # Grant single course
            db.collection('users').document(user_id).update({
                'enrolledCourses': firestore.ArrayUnion([course_name]),
                'updatedAt': datetime.now()
            })
        
        return jsonify({
            'success': True,
            'message': 'Payment verified and course access granted'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# CLOUDFLARE STREAM ENDPOINTS (Admin)
# ============================================

@app.route('/api/admin/upload-video', methods=['POST'])
def upload_video_to_stream():
    """Upload video to Cloudflare Stream (Admin only)"""
    # TODO: Add admin authentication
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        video_file = request.files['video']
        metadata = request.form.get('metadata', '{}')
        metadata = json.loads(metadata)
        
        # Upload to Cloudflare Stream
        url = f'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/stream'
        
        headers = {
            'Authorization': f'Bearer {CLOUDFLARE_API_TOKEN}'
        }
        
        files = {
            'file': video_file
        }
        
        response = requests.post(url, headers=headers, files=files)
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to upload video'}), 500
        
        video_data = response.json()
        video_id = video_data['result']['uid']
        
        return jsonify({
            'success': True,
            'videoId': video_id,
            'data': video_data['result']
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/video/<video_id>', methods=['DELETE'])
def delete_video_from_stream(video_id):
    """Delete video from Cloudflare Stream (Admin only)"""
    # TODO: Add admin authentication
    try:
        url = f'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/stream/{video_id}'
        
        headers = {
            'Authorization': f'Bearer {CLOUDFLARE_API_TOKEN}'
        }
        
        response = requests.delete(url, headers=headers)
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to delete video'}), 500
        
        return jsonify({
            'success': True,
            'message': 'Video deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# ANALYTICS ENDPOINTS
# ============================================

@app.route('/api/user/stats', methods=['GET'])
@verify_firebase_token
def get_user_stats():
    """Get user statistics"""
    try:
        user_id = request.user_id
        
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        stats = user_doc.to_dict().get('stats', {})
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/stats/video-watched', methods=['POST'])
@verify_firebase_token
def track_video_watched():
    """Track video watch progress"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        video_id = data.get('videoId')
        progress = data.get('progress', 0)  # 0-100
        
        # Update stats
        db.collection('users').document(user_id).update({
            'stats.videosWatched': firestore.Increment(1)
        })
        
        # Track individual video progress
        db.collection('users').document(user_id).collection('videoProgress').document(video_id).set({
            'videoId': video_id,
            'progress': progress,
            'lastWatched': datetime.now()
        }, merge=True)
        
        return jsonify({
            'success': True,
            'message': 'Progress tracked'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# FEATURE 3: LEADERBOARD ENDPOINT
# ============================================

@app.route('/api/student/leaderboard/<test_id>', methods=['GET'])
@verify_firebase_token
def get_student_leaderboard(test_id):
    """
    Get leaderboard for a specific test.
    """
    try:
        user_id = request.user_id
        
        print(f"📊 Leaderboard request for test {test_id} by user {user_id}")

        # --- Fetch Test Details ---
        test_doc_ref = db.collection('tests').document(test_id)
        test_doc = test_doc_ref.get()

        if not test_doc.exists:
            print(f"❌ Test not found: {test_id}")
            return jsonify({'error': 'Test not found'}), 404

        test_data = test_doc.to_dict()
        test_name = test_data.get('name', 'Test')
        total_marks = test_data.get('totalMarks', 0)
        
        print(f"✅ Test found: {test_name}, Total Marks: {total_marks}")

        # --- Fetch All Attempts for This Test ---
        try:
            attempts_query = db.collection('testAttempts') \
                .where('testId', '==', test_id) \
                .order_by('score', direction=firestore.Query.DESCENDING)

            attempts_list = []
            for doc in attempts_query.stream():
                attempt_data = doc.to_dict()
                attempt_data['id'] = doc.id
                
                # ✅ IMPROVED TIMESTAMP CONVERSION
                if 'submittedAt' in attempt_data:
                    submitted_at = attempt_data['submittedAt']
                    
                    try:
                        # Check if it's already a datetime object
                        if isinstance(submitted_at, datetime):
                            attempt_data['submittedAt'] = submitted_at.isoformat() + "Z"
                        # Check if it's a Firestore Timestamp
                        elif hasattr(submitted_at, 'seconds'):
                            # Convert Firestore Timestamp to datetime
                            timestamp_datetime = datetime.fromtimestamp(submitted_at.seconds)
                            attempt_data['submittedAt'] = timestamp_datetime.isoformat() + "Z"
                        # Check if it has _seconds (older format)
                        elif hasattr(submitted_at, '_seconds'):
                            timestamp_datetime = datetime.fromtimestamp(submitted_at._seconds)
                            attempt_data['submittedAt'] = timestamp_datetime.isoformat() + "Z"
                        # If it's already a string, validate and keep it
                        elif isinstance(submitted_at, str):
                            # Try to parse it to validate
                            try:
                                datetime.fromisoformat(submitted_at.replace('Z', ''))
                                # It's valid, keep it
                                pass
                            except:
                                # Invalid string, set to None
                                print(f"⚠️ Invalid timestamp string: {submitted_at}")
                                attempt_data['submittedAt'] = None
                        else:
                            print(f"⚠️ Unknown timestamp type: {type(submitted_at)}")
                            attempt_data['submittedAt'] = None
                    
                    except Exception as ts_error:
                        print(f"⚠️ Timestamp conversion error for attempt {doc.id}: {ts_error}")
                        print(f"   Timestamp value: {submitted_at}")
                        print(f"   Timestamp type: {type(submitted_at)}")
                        attempt_data['submittedAt'] = None
                else:
                    attempt_data['submittedAt'] = None
                
                # Get user name
                try:
                    user_doc = db.collection('users').document(attempt_data.get('userId', '')).get()
                    if user_doc.exists:
                        attempt_data['userName'] = user_doc.to_dict().get('name', 'Anonymous')
                    else:
                        attempt_data['userName'] = 'Anonymous'
                except:
                    attempt_data['userName'] = 'Anonymous'
                
                attempts_list.append(attempt_data)
            
            print(f"✅ Found {len(attempts_list)} attempts")
            
        except Exception as query_error:
            error_msg = str(query_error)
            if 'index' in error_msg.lower() or 'requires an index' in error_msg.lower():
                print(f"❌ Firestore index required! Error: {error_msg}")
                return jsonify({
                    'error': 'Database index required',
                    'message': 'Please create a Firestore index to enable leaderboard sorting.'
                }), 503
            else:
                raise query_error

        # --- Handle Empty Leaderboard ---
        if len(attempts_list) == 0:
            return jsonify({
                'success': True,
                'data': {
                    'testId': test_id,
                    'testName': test_name,
                    'totalMarks': total_marks,
                    'totalAttempts': 0,
                    'attempts': [],
                    'currentUser': {
                        'attempted': False,
                        'rank': None,
                        'percentile': None,
                        'attemptData': None
                    },
                    'avgScore': 0,
                    'highestScore': 0
                }
            }), 200

        # --- Assign Ranks ---
        current_rank = 1
        for i, attempt in enumerate(attempts_list):
            if i > 0 and attempt.get('score', 0) < attempts_list[i-1].get('score', 0):
                current_rank = i + 1
            attempt['rank'] = current_rank

        # --- Find Current User's Attempt ---
        current_user_attempt = None
        current_user_rank = None
        current_user_percentile = None

        for attempt in attempts_list:
            if attempt.get('userId') == user_id:
                current_user_attempt = attempt
                current_user_rank = attempt['rank']
                
                total_attempts = len(attempts_list)
                current_user_percentile = ((total_attempts - current_user_rank + 1) / total_attempts) * 100
                break

        # --- Calculate Stats ---
        total_attempts = len(attempts_list)
        percentages = [a.get('percentage', 0) for a in attempts_list]
        avg_score = sum(percentages) / len(percentages) if percentages else 0
        highest_score_percentage = attempts_list[0].get('percentage', 0) if attempts_list else 0

        # --- Response ---
        response_data = {
            'testId': test_id,
            'testName': test_name,
            'totalMarks': total_marks,
            'totalAttempts': total_attempts,
            'attempts': attempts_list,
            'currentUser': {
                'attempted': current_user_attempt is not None,
                'rank': current_user_rank,
                'percentile': round(current_user_percentile, 2) if current_user_percentile else None,
                'attemptData': current_user_attempt
            },
            'avgScore': round(avg_score, 2),
            'highestScore': round(highest_score_percentage, 2)
        }

        print(f"✅ Leaderboard generated: {total_attempts} attempts")

        return jsonify({'success': True, 'data': response_data}), 200

    except Exception as e:
        print(f"❌ LEADERBOARD ERROR for test {test_id}:")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error message: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'error': 'Failed to load leaderboard',
            'details': str(e),
            'type': type(e).__name__
        }), 500

# ============================================
# HEALTH CHECK
# ============================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'firebase': db is not None,
            'razorpay': razorpay_client is not None
        }
    }), 200

@app.route('/', methods=['GET'])
def index():
    """Root endpoint"""
    return jsonify({
        'message': 'GeoCatalyst API Server',
        'version': '1.0.0',
        'documentation': '/api/docs'
    }), 200

# ============================================
# ERROR HANDLERS
# ============================================

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500

# ============================================
# RUN SERVER
# ============================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print(f"""
    ✅ GeoCatalyst Backend Server Starting...
    📡 Port: {port}
    🔧 Debug Mode: {debug}
    🔥 Firebase: {'Connected' if db else 'Not Connected'}
    💳 Razorpay: {'Configured' if razorpay_client else 'Not Configured'}
    """)
    
    app.run(host='0.0.0.0', port=port, debug=debug)