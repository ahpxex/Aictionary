// export-signing-identity.swift
// Exports the team's "Developer ID Application" identity (certificate +
// private key) from the login keychain as a password-protected PKCS#12,
// for the APPLE_CERTIFICATE GitHub secret.
//
//   /usr/bin/swift scripts/export-signing-identity.swift <out.p12> <password>
//
// `security export` cannot select a single identity (it dumps every key
// in the keychain), so this goes through the Security framework and
// picks the one identity by label + team. macOS asks once for the login
// keychain password to release the private key.

import Foundation
import Security

let teamID = "L7GVXT64TV"
let label = "Developer ID Application"

let args = CommandLine.arguments
guard args.count == 3 else {
    FileHandle.standardError.write(Data("usage: export-signing-identity <out.p12> <password>\n".utf8))
    exit(2)
}
let outPath = args[1]
let password = args[2]

var result: CFTypeRef?
let status = SecItemCopyMatching([
    kSecClass: kSecClassIdentity,
    kSecMatchLimit: kSecMatchLimitAll,
    kSecReturnRef: true,
] as CFDictionary, &result)
guard status == errSecSuccess, let identities = result as? [SecIdentity] else {
    FileHandle.standardError.write(Data("no identities in keychain (status \(status))\n".utf8))
    exit(1)
}

func subject(of identity: SecIdentity) -> String {
    var cert: SecCertificate?
    guard SecIdentityCopyCertificate(identity, &cert) == errSecSuccess, let cert else { return "" }
    return (SecCertificateCopySubjectSummary(cert) as String?) ?? ""
}

let matches = identities.filter {
    let s = subject(of: $0)
    return s.hasPrefix(label) && s.contains("(\(teamID))")
}
guard matches.count == 1, let identity = matches.first else {
    FileHandle.standardError.write(Data("expected exactly one '\(label)' identity for team \(teamID), found \(matches.count)\n".utf8))
    exit(1)
}
print("exporting: \(subject(of: identity))")

var params = SecItemImportExportKeyParameters()
params.version = UInt32(SEC_KEY_IMPORT_EXPORT_PARAMS_VERSION)
params.passphrase = Unmanaged.passRetained(password as CFString)
var data: CFData?
let exportStatus = SecItemExport(identity, .formatPKCS12, [], &params, &data)
guard exportStatus == errSecSuccess, let p12 = data as Data? else {
    let msg = SecCopyErrorMessageString(exportStatus, nil) as String? ?? "\(exportStatus)"
    FileHandle.standardError.write(Data("export failed: \(msg)\n".utf8))
    exit(1)
}
let url = URL(fileURLWithPath: outPath)
try p12.write(to: url, options: .atomic)
try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: outPath)
print("wrote \(p12.count) bytes to \(outPath)")
