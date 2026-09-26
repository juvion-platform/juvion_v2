# juvi_api.api.MobileApi

## Load the API package
```dart
import 'package:juvi_api/api.dart';
```

All URIs are relative to *http://localhost/api/juvi-app/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**advanceOnboarding**](MobileApi.md#advanceonboarding) | **POST** /me/onboarding/advance | Complete the current onboarding step
[**changePassword**](MobileApi.md#changepassword) | **POST** /auth/change-password | Change password; revokes other sessions
[**getChannel**](MobileApi.md#getchannel) | **GET** /channels/{id} | Channel header and About
[**getConfig**](MobileApi.md#getconfig) | **GET** /config | Institution configuration for the signed-in user
[**getMe**](MobileApi.md#getme) | **GET** /me | Identity card, account state, settings, institution
[**getSettings**](MobileApi.md#getsettings) | **GET** /me/settings | Notification and language settings
[**listDevices**](MobileApi.md#listdevices) | **GET** /me/devices | Signed-in devices
[**listSpaces**](MobileApi.md#listspaces) | **GET** /spaces | Grouped channel list
[**lookupInstitution**](MobileApi.md#lookupinstitution) | **GET** /institutions/{code} | Resolve an institution code for sign-in
[**markChannelRead**](MobileApi.md#markchannelread) | **POST** /channels/{id}/read | Mark a channel read
[**muteChannel**](MobileApi.md#mutechannel) | **PUT** /channels/{id}/mute | Mute a channel
[**refresh**](MobileApi.md#refresh) | **POST** /auth/refresh | Rotate the refresh token
[**revokeDevice**](MobileApi.md#revokedevice) | **DELETE** /me/devices/{id} | Sign out one device
[**revokeOtherDevices**](MobileApi.md#revokeotherdevices) | **POST** /me/devices/revoke-others | Sign out every other device
[**signIn**](MobileApi.md#signin) | **POST** /auth/sign-in | Sign in with institution, identifier and password
[**signOut**](MobileApi.md#signout) | **POST** /auth/sign-out | Revoke this session
[**unmuteChannel**](MobileApi.md#unmutechannel) | **DELETE** /channels/{id}/mute | Unmute a channel
[**updateSettings**](MobileApi.md#updatesettings) | **PATCH** /me/settings | Update settings
[**uploadPhoto**](MobileApi.md#uploadphoto) | **POST** /me/photo | Upload a profile photo (multipart field \&quot;file\&quot;)


# **advanceOnboarding**
> OnboardingState advanceOnboarding(onboardingAdvance)

Complete the current onboarding step

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final OnboardingAdvance onboardingAdvance = ; // OnboardingAdvance | 

try {
    final response = api.advanceOnboarding(onboardingAdvance);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->advanceOnboarding: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **onboardingAdvance** | [**OnboardingAdvance**](OnboardingAdvance.md)|  | [optional] 

### Return type

[**OnboardingState**](OnboardingState.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **changePassword**
> changePassword(changePasswordRequest)

Change password; revokes other sessions

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final ChangePasswordRequest changePasswordRequest = ; // ChangePasswordRequest | 

try {
    api.changePassword(changePasswordRequest);
} catch on DioException (e) {
    print('Exception when calling MobileApi->changePassword: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **changePasswordRequest** | [**ChangePasswordRequest**](ChangePasswordRequest.md)|  | [optional] 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getChannel**
> ChannelDetail getChannel(id)

Channel header and About

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.getChannel(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getChannel: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**ChannelDetail**](ChannelDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getConfig**
> Config getConfig()

Institution configuration for the signed-in user

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getConfig();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getConfig: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Config**](Config.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMe**
> Me getMe()

Identity card, account state, settings, institution

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getMe();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getMe: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Me**](Me.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getSettings**
> Settings getSettings()

Notification and language settings

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.getSettings();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->getSettings: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Settings**](Settings.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listDevices**
> Devices listDevices()

Signed-in devices

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.listDevices();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->listDevices: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Devices**](Devices.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listSpaces**
> Spaces listSpaces()

Grouped channel list

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.listSpaces();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->listSpaces: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Spaces**](Spaces.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **lookupInstitution**
> InstitutionLookup lookupInstitution(code)

Resolve an institution code for sign-in

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String code = code_example; // String | 

try {
    final response = api.lookupInstitution(code);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->lookupInstitution: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **String**|  | 

### Return type

[**InstitutionLookup**](InstitutionLookup.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **markChannelRead**
> ReadResult markChannelRead(id)

Mark a channel read

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.markChannelRead(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->markChannelRead: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**ReadResult**](ReadResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **muteChannel**
> MuteResult muteChannel(id)

Mute a channel

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.muteChannel(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->muteChannel: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**MuteResult**](MuteResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **refresh**
> Tokens refresh(refreshRequest)

Rotate the refresh token

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final RefreshRequest refreshRequest = ; // RefreshRequest | 

try {
    final response = api.refresh(refreshRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->refresh: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshRequest** | [**RefreshRequest**](RefreshRequest.md)|  | [optional] 

### Return type

[**Tokens**](Tokens.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **revokeDevice**
> revokeDevice(id)

Sign out one device

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    api.revokeDevice(id);
} catch on DioException (e) {
    print('Exception when calling MobileApi->revokeDevice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **revokeOtherDevices**
> RevokedCount revokeOtherDevices()

Sign out every other device

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    final response = api.revokeOtherDevices();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->revokeOtherDevices: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**RevokedCount**](RevokedCount.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **signIn**
> SignInResponse signIn(signInRequest)

Sign in with institution, identifier and password

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final SignInRequest signInRequest = ; // SignInRequest | 

try {
    final response = api.signIn(signInRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->signIn: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **signInRequest** | [**SignInRequest**](SignInRequest.md)|  | [optional] 

### Return type

[**SignInResponse**](SignInResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **signOut**
> signOut()

Revoke this session

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();

try {
    api.signOut();
} catch on DioException (e) {
    print('Exception when calling MobileApi->signOut: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unmuteChannel**
> MuteResult unmuteChannel(id)

Unmute a channel

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final String id = id_example; // String | 

try {
    final response = api.unmuteChannel(id);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->unmuteChannel: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

[**MuteResult**](MuteResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateSettings**
> Settings updateSettings(settingsPatch)

Update settings

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final SettingsPatch settingsPatch = ; // SettingsPatch | 

try {
    final response = api.updateSettings(settingsPatch);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->updateSettings: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **settingsPatch** | [**SettingsPatch**](SettingsPatch.md)|  | [optional] 

### Return type

[**Settings**](Settings.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadPhoto**
> PhotoResult uploadPhoto(file)

Upload a profile photo (multipart field \"file\")

### Example
```dart
import 'package:juvi_api/api.dart';

final api = JuviApi().getMobileApi();
final MultipartFile file = BINARY_DATA_HERE; // MultipartFile | 

try {
    final response = api.uploadPhoto(file);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MobileApi->uploadPhoto: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | **MultipartFile**|  | 

### Return type

[**PhotoResult**](PhotoResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

